/**
 * cleartext-guard.ts — refuse Solidity that leaks plaintext from encrypted handles.
 *
 * Strategy: a small set of high-precision regex patterns. We deliberately
 * avoid pulling a full Solidity parser (slow, large dep). False-positives
 * are acceptable here — this guard runs against templates we control.
 *
 * Plan 04-01, Task 2.
 */

export interface ForbiddenPattern {
  /** Regex matched against full source text. */
  pattern: RegExp;
  /** Short stable identifier used in error messages. */
  name: string;
  /** Canonical replacement suggestion for the user. */
  replacement: string;
}

export class CleartextLeakError extends Error {
  override readonly name = "CleartextLeakError";
  readonly patternName: string;
  readonly replacement: string;
  constructor(patternName: string, replacement: string, snippet: string) {
    super(
      `Cleartext leak refused — pattern "${patternName}" detected.\n` +
        `  Snippet: ${snippet.trim().slice(0, 120)}\n` +
        `  Use instead: ${replacement}`,
    );
    this.patternName = patternName;
    this.replacement = replacement;
  }
}

/**
 * Static (non-type-aware) forbidden patterns. These match regardless of
 * surrounding declarations.
 */
const STATIC_FORBIDDEN: ForbiddenPattern[] = [
  {
    pattern: /require\s*\(\s*FHE\.decrypt\s*\(/,
    name: "require(FHE.decrypt(...))",
    replacement:
      "FHE.allow(handle, recipient) and decrypt off-chain via the relayer SDK; on-chain require() against decrypted plaintext is forbidden",
  },
  {
    pattern: /require\s*\(\s*decrypt\s*\(/,
    name: "require(decrypt(...))",
    replacement:
      "decrypt(...) is not a valid runtime call on encrypted handles; use FHE.allow + off-chain decryption",
  },
  {
    pattern: /\bif\s*\(\s*FHE\.decrypt\s*\(/,
    name: "if (FHE.decrypt(...))",
    replacement:
      "ebool cond = FHE.lt/eq/...; FHE.allow(cond, recipient); branch off-chain or use FHE.select(cond, x, y) for on-chain conditional values",
  },
  {
    pattern: /\bif\s*\(\s*decrypt\s*\(/,
    name: "if (decrypt(...))",
    replacement:
      "decrypt(...) is not a valid runtime call; use ebool cond = FHE.lt/eq/...; FHE.select(cond, x, y) for on-chain branching",
  },
  {
    pattern: /\bdecrypt\s*\(/,
    name: "decrypt(<euint slot>)",
    replacement:
      "decrypt(...) is not callable on euint storage slots at runtime; use FHE.allow(slot, recipient) and decrypt off-chain via the relayer SDK",
  },
];

/**
 * Type-aware comparison patterns. We first scan declarations of the form
 * `(euint\d+|ebool|eaddress) <name>` and then look for forbidden cleartext
 * comparisons of those identifiers.
 */
const COMPARISON_OPS: Array<{ op: string; name: string; replacement: string }> =
  [
    { op: "==", name: "euint == euint", replacement: "FHE.eq(a, b)" },
    { op: "!=", name: "euint != euint", replacement: "FHE.ne(a, b)" },
    { op: "<=", name: "euint <= euint", replacement: "FHE.le(a, b)" },
    { op: ">=", name: "euint >= euint", replacement: "FHE.ge(a, b)" },
    { op: "<", name: "euint < euint", replacement: "FHE.lt(a, b)" },
    { op: ">", name: "euint > euint", replacement: "FHE.gt(a, b)" },
  ];

const ENCRYPTED_DECL_RE =
  /\b(euint8|euint16|euint32|euint64|euint128|euint256|ebool|eaddress)\s+(?:public\s+|private\s+|internal\s+|memory\s+|storage\s+|calldata\s+)?([A-Za-z_][A-Za-z0-9_]*)\b/g;

const EBOOL_DECL_RE =
  /\bebool\s+(?:public\s+|private\s+|internal\s+|memory\s+|storage\s+|calldata\s+)?([A-Za-z_][A-Za-z0-9_]*)\b/g;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findEncryptedIdentifiers(source: string): Set<string> {
  const ids = new Set<string>();
  let m: RegExpExecArray | null;
  ENCRYPTED_DECL_RE.lastIndex = 0;
  while ((m = ENCRYPTED_DECL_RE.exec(source)) !== null) {
    ids.add(m[2] as string);
  }
  return ids;
}

function findEboolIdentifiers(source: string): Set<string> {
  const ids = new Set<string>();
  let m: RegExpExecArray | null;
  EBOOL_DECL_RE.lastIndex = 0;
  while ((m = EBOOL_DECL_RE.exec(source)) !== null) {
    ids.add(m[1] as string);
  }
  return ids;
}

/**
 * Build the full FORBIDDEN_PATTERNS list — useful for tests / introspection.
 * Note: type-aware comparisons are represented here with placeholder regexes
 * (matching the operator alone) since real detection is contextual; the
 * authoritative check lives in `assertNoCleartextLeak`.
 */
export const FORBIDDEN_PATTERNS: ForbiddenPattern[] = [
  ...STATIC_FORBIDDEN,
  ...COMPARISON_OPS.map<ForbiddenPattern>(({ op, name, replacement }) => ({
    pattern: new RegExp(`euint\\d*\\s+\\w+[\\s\\S]*?${escapeRegex(op)}`),
    name,
    replacement,
  })),
  {
    pattern: /ebool\s+\w+[\s\S]*?\bif\s*\(\s*\w+\s*\)/,
    name: "if (ebool)",
    replacement:
      "ebool branching on plaintext is forbidden; use euint v = FHE.select(cond, x, y) to keep the value encrypted",
  },
];

/**
 * Throw `CleartextLeakError` on the first match. Otherwise return silently.
 */
export function assertNoCleartextLeak(source: string): void {
  // 1. Static patterns
  for (const p of STATIC_FORBIDDEN) {
    const m = p.pattern.exec(source);
    if (m) {
      throw new CleartextLeakError(p.name, p.replacement, m[0]);
    }
  }

  // 2. Type-aware comparison patterns
  const encIds = findEncryptedIdentifiers(source);
  if (encIds.size > 0) {
    for (const id of encIds) {
      for (const { op, name, replacement } of COMPARISON_OPS) {
        // Match `<id> <op> ...` or `... <op> <id>`. Avoid declaration line
        // (we explicitly exclude lines that look like a declaration of <id>).
        const re = new RegExp(
          `\\b${escapeRegex(id)}\\s*${escapeRegex(op)}\\s*\\w|\\w\\s*${escapeRegex(op)}\\s*${escapeRegex(id)}\\b`,
        );
        const m = re.exec(source);
        if (m) {
          // Filter false positives on the *declaration line* itself
          // (e.g. `euint64 a = b;` contains `=` but not a cleartext compare).
          // We require the operator to be a comparison, not assignment.
          throw new CleartextLeakError(name, replacement, m[0]);
        }
      }
    }
  }

  // 3. Boolean cleartext branching: `if (<eboolId>)` or `if (!<eboolId>)`
  const eboolIds = findEboolIdentifiers(source);
  for (const id of eboolIds) {
    const re = new RegExp(`\\bif\\s*\\(\\s*!?\\s*${escapeRegex(id)}\\s*\\)`);
    const m = re.exec(source);
    if (m) {
      throw new CleartextLeakError(
        "if (ebool)",
        "ebool branching on plaintext is forbidden; use FHE.select(cond, x, y) to keep the value encrypted",
        m[0],
      );
    }
  }
}
