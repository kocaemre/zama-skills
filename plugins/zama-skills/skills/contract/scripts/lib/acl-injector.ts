/**
 * acl-injector.ts — post-process Solidity source to add the ACL grants that
 * @fhevm/solidity@^0.11.x requires after every encrypted state-write and
 * before every encrypted return.
 *
 * Idempotent: running twice on the same source produces no duplicate grants.
 *
 * Plan 04-01, Task 2.
 */

export interface AclInjectResult {
  source: string;
  injected: number;
}

const ENCRYPTED_TYPE_RE =
  /^(euint8|euint16|euint32|euint64|euint128|euint256|ebool|eaddress)$/;

interface DeclaredHandle {
  name: string;
  type: string;
}

/**
 * Find every variable declaration whose type is an encrypted handle.
 * Includes contract-level state vars and local declarations.
 */
function collectEncryptedHandles(source: string): Map<string, string> {
  const out = new Map<string, string>();
  const re =
    /\b(euint8|euint16|euint32|euint64|euint128|euint256|ebool|eaddress)\s+(?:public\s+|private\s+|internal\s+|memory\s+|storage\s+|calldata\s+)?([A-Za-z_][A-Za-z0-9_]*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    out.set(m[2] as string, m[1] as string);
  }
  // mapping(address => euint64) balance; — also catch the mapping name
  const mappingRe =
    /\bmapping\s*\(\s*\w+\s*=>\s*(euint8|euint16|euint32|euint64|euint128|euint256|ebool|eaddress)\s*\)\s+(?:public\s+|private\s+|internal\s+)?([A-Za-z_][A-Za-z0-9_]*)\b/g;
  while ((m = mappingRe.exec(source)) !== null) {
    out.set(m[2] as string, m[1] as string);
  }
  return out;
}

/**
 * Inject `FHE.allowThis(<lhs>);` after assignments to encrypted handles, and
 * `FHE.allow(<expr>, msg.sender);` before `return <expr>;` when the enclosing
 * function returns an encrypted type.
 */
export function injectAclGrants(source: string): AclInjectResult {
  const handles = collectEncryptedHandles(source);
  let injected = 0;
  const lines = source.split("\n");
  const out: string[] = [];

  // ---- Pass 1: storage-write grants (FHE.allowThis after `<handle> = ...;`)
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] as string;
    out.push(line);

    // Match: `[<indent>]<lhs>[<key>] = <expr>;` where lhs is an encrypted handle
    const writeRe =
      /^(\s*)([A-Za-z_][A-Za-z0-9_]*)(\[[^\]]+\])?\s*=\s*[^=].*;\s*$/;
    const w = writeRe.exec(line);
    if (!w) continue;
    const indent = w[1] as string;
    const lhsBase = w[2] as string;
    const lhsKey = (w[3] as string | undefined) ?? "";
    const handleType = handles.get(lhsBase);
    if (!handleType) continue;
    if (!ENCRYPTED_TYPE_RE.test(handleType)) continue;

    // Skip declarations like `euint64 newVal = ...;` — these are local temps,
    // not state writes. We approximate by checking the line doesn't begin
    // with a type token.
    const trimmed = line.trim();
    if (/^(euint8|euint16|euint32|euint64|euint128|euint256|ebool|eaddress)\b/.test(trimmed)) {
      continue;
    }

    const handleExpr = `${lhsBase}${lhsKey}`;
    const grantLine = `${indent}FHE.allowThis(${handleExpr});`;

    // Idempotency: if next non-blank line is already this grant (or any
    // FHE.allowThis on the same handle expression), skip.
    let j = i + 1;
    while (j < lines.length && (lines[j] as string).trim() === "") j += 1;
    const next = (lines[j] ?? "").trim();
    const escExpr = handleExpr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const alreadyAllowThis = new RegExp(
      `^FHE\\.allowThis\\(\\s*${escExpr}\\s*\\)\\s*;`,
    ).test(next);
    if (alreadyAllowThis) continue;

    out.push(grantLine);
    injected += 1;
  }

  // ---- Pass 2: return grants (FHE.allow(<expr>, msg.sender) before `return <expr>;`)
  const sourceP2 = out.join("\n");
  const linesP2 = sourceP2.split("\n");
  const out2: string[] = [];

  // Track the "current function returns encrypted type" by scanning function signatures.
  // Heuristic: when we see a function signature with `returns (eu... or ebool or eaddress)`,
  // mark the brace depth at which we entered, and unmark on matching `}`.
  let inEncryptedReturnFn = false;
  let braceDepthAtFnStart = -1;
  let braceDepth = 0;

  const fnSigRe =
    /\bfunction\s+\w+\s*\([^)]*\)[^{;]*\breturns?\s*\(\s*(euint8|euint16|euint32|euint64|euint128|euint256|ebool|eaddress)\b/;

  for (let i = 0; i < linesP2.length; i += 1) {
    const line = linesP2[i] as string;

    // Maintain brace depth (rough — strings/comments not parsed; OK for our templates)
    const opens = (line.match(/\{/g) ?? []).length;
    const closes = (line.match(/\}/g) ?? []).length;

    if (!inEncryptedReturnFn && fnSigRe.test(line)) {
      inEncryptedReturnFn = true;
      braceDepthAtFnStart = braceDepth;
    }

    // Detect `return <expr>;`
    if (inEncryptedReturnFn) {
      const retRe = /^(\s*)return\s+([A-Za-z_][A-Za-z0-9_\[\].]*)\s*;\s*$/;
      const r = retRe.exec(line);
      if (r) {
        const indent = r[1] as string;
        const expr = r[2] as string;
        // Idempotency: scan recent lines for `FHE.allow(<expr>, msg.sender);`
        const escExpr = expr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const allowRe = new RegExp(
          `FHE\\.allow\\(\\s*${escExpr}\\s*,\\s*msg\\.sender\\s*\\)\\s*;`,
        );
        const recent = out2.slice(Math.max(0, out2.length - 5)).join("\n");
        if (!allowRe.test(recent)) {
          out2.push(`${indent}FHE.allow(${expr}, msg.sender);`);
          injected += 1;
        }
      }
    }

    out2.push(line);

    braceDepth += opens - closes;
    if (inEncryptedReturnFn && braceDepth <= braceDepthAtFnStart) {
      inEncryptedReturnFn = false;
      braceDepthAtFnStart = -1;
    }
  }

  return { source: out2.join("\n"), injected };
}
