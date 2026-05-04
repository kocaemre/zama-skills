/**
 * acl-checker.ts — detect missing ACL grants in Solidity sources.
 *
 * Two patterns flagged:
 *  1. Storage write of an encrypted handle without subsequent
 *     `FHE.allowThis(<handle>)`.
 *  2. Function returning encrypted type that does NOT call
 *     `FHE.allow(<expr>, msg.sender)` on the returned expression before
 *     the `return` statement.
 *
 * Heuristic, not a full Solidity parser. False positives possible on
 * unusual code; designed to be useful for the typical fhEVM contract.
 *
 * Plan v1.1-skills audit, Task 2.
 */
import type { Finding } from "./report.ts";

const ENCRYPTED_TYPES = [
  "euint8",
  "euint16",
  "euint32",
  "euint64",
  "euint128",
  "euint256",
  "ebool",
  "eaddress",
];

const ENCRYPTED_TYPE_RE = new RegExp(
  `^(?:${ENCRYPTED_TYPES.join("|")})$`,
);

function collectEncryptedHandles(source: string): Map<string, string> {
  const out = new Map<string, string>();
  const decl = new RegExp(
    `\\b(${ENCRYPTED_TYPES.join("|")})\\s+(?:public\\s+|private\\s+|internal\\s+|memory\\s+|storage\\s+|calldata\\s+)?([A-Za-z_][A-Za-z0-9_]*)\\b`,
    "g",
  );
  let m: RegExpExecArray | null;
  while ((m = decl.exec(source)) !== null) {
    out.set(m[2] as string, m[1] as string);
  }
  const mappingRe = new RegExp(
    `\\bmapping\\s*\\(\\s*\\w+\\s*=>\\s*(${ENCRYPTED_TYPES.join("|")})\\s*\\)\\s+(?:public\\s+|private\\s+|internal\\s+)?([A-Za-z_][A-Za-z0-9_]*)\\b`,
    "g",
  );
  while ((m = mappingRe.exec(source)) !== null) {
    out.set(m[2] as string, m[1] as string);
  }
  return out;
}

function lineNumber(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i += 1) {
    if (source[i] === "\n") line += 1;
  }
  return line;
}

export function checkAcl(file: string, source: string): Finding[] {
  if (!file.endsWith(".sol")) return [];
  const findings: Finding[] = [];
  const handles = collectEncryptedHandles(source);
  const lines = source.split("\n");

  // ---- Pattern 1: storage write without FHE.allowThis ----
  const writeRe = /^(\s*)([A-Za-z_][A-Za-z0-9_]*)(\[[^\]]+\])?\s*=\s*[^=].*;\s*$/;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] as string;
    const w = writeRe.exec(line);
    if (!w) continue;
    const lhsBase = w[2] as string;
    const lhsKey = (w[3] as string | undefined) ?? "";
    const handleType = handles.get(lhsBase);
    if (!handleType || !ENCRYPTED_TYPE_RE.test(handleType)) continue;

    const trimmed = line.trim();
    if (
      new RegExp(`^(?:${ENCRYPTED_TYPES.join("|")})\\b`).test(trimmed)
    ) {
      // Local declaration — not a state write
      continue;
    }
    if (lhsBase === handleType) continue; // type token start

    const handleExpr = `${lhsBase}${lhsKey}`;
    // Look ahead up to 5 lines for `FHE.allowThis(<handleExpr>` (skipping
    // comment-only lines so commented-out grants don't suppress findings).
    const lookahead = lines
      .slice(i + 1, i + 6)
      .filter((l) => !/^\s*(?:\/\/|\*|\/\*)/.test(l))
      .join("\n");
    const escExpr = handleExpr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const allowThisRe = new RegExp(
      `FHE\\.allowThis\\(\\s*${escExpr}\\s*\\)`,
    );
    if (allowThisRe.test(lookahead)) continue;

    findings.push({
      file,
      line: i + 1,
      severity: "CRITICAL",
      category: "ACL",
      rule: "acl-missing-allowThis",
      message: `Encrypted state-write to \`${handleExpr}\` is not followed by \`FHE.allowThis(${handleExpr})\`. The contract itself loses access to the ciphertext on the next call.`,
      suggestion: `Add \`FHE.allowThis(${handleExpr});\` immediately after the assignment, plus \`FHE.allow(${handleExpr}, recipient);\` for any external reader.`,
      snippet: line.trim(),
    });
  }

  // ---- Pattern 2: encrypted return without FHE.allow(expr, msg.sender) ----
  const fnSigRe = new RegExp(
    `\\bfunction\\s+(\\w+)\\s*\\([^)]*\\)[^{;]*\\breturns?\\s*\\(\\s*(${ENCRYPTED_TYPES.join("|")})\\b`,
  );
  let inEncFn = false;
  let braceDepthAtFnStart = -1;
  let braceDepth = 0;
  let currentFnLine = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] as string;
    const opens = (line.match(/\{/g) ?? []).length;
    const closes = (line.match(/\}/g) ?? []).length;

    if (!inEncFn && fnSigRe.test(line)) {
      inEncFn = true;
      braceDepthAtFnStart = braceDepth;
      currentFnLine = i + 1;
    }

    if (inEncFn) {
      const retRe = /^(\s*)return\s+([A-Za-z_][A-Za-z0-9_\[\].]*)\s*;\s*$/;
      const r = retRe.exec(line);
      if (r) {
        const expr = r[2] as string;
        // Look back up to 10 lines for `FHE.allow(<expr>, <any-address>)`.
        // Valid contracts may grant to msg.sender OR a specific recipient
        // (auction beneficiary, escrow target). A missing grant entirely is
        // the CRITICAL bug. If at least one grant exists but none target
        // msg.sender, downgrade to WARNING ("confirm intended recipient");
        // if any grant targets msg.sender, the function is fine.
        const lookback = lines
          .slice(Math.max(0, i - 10), i)
          .filter((l) => !/^\s*(?:\/\/|\*|\/\*)/.test(l))
          .join("\n");
        const escExpr = expr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const allowAnyRe = new RegExp(
          `FHE\\.allow\\(\\s*${escExpr}\\s*,\\s*([^)]+?)\\s*\\)`,
          "g",
        );
        const grants: string[] = [];
        let am: RegExpExecArray | null;
        while ((am = allowAnyRe.exec(lookback)) !== null) {
          grants.push((am[1] ?? "").trim());
        }
        if (grants.length === 0) {
          findings.push({
            file,
            line: i + 1,
            severity: "CRITICAL",
            category: "ACL",
            rule: "acl-missing-allow-return",
            message: `Encrypted value \`${expr}\` is returned without any \`FHE.allow(${expr}, ...)\`. No caller will be able to decrypt.`,
            suggestion: `Add \`FHE.allow(${expr}, msg.sender);\` (or the intended recipient address) before \`return ${expr};\`. Note: this requires a non-view function.`,
            snippet: line.trim(),
          });
        } else if (!grants.some((g) => /msg\.sender/.test(g))) {
          findings.push({
            file,
            line: i + 1,
            severity: "WARNING",
            category: "ACL",
            rule: "acl-allow-non-sender",
            message: `Encrypted value \`${expr}\` is returned with \`FHE.allow\` granted to ${grants.map((g) => `\`${g}\``).join(", ")} but not to \`msg.sender\`. This is valid for some patterns (auction beneficiary, escrow recipient) — confirm the intended recipient.`,
            suggestion: `If the caller should be able to decrypt the return value, also add \`FHE.allow(${expr}, msg.sender);\`.`,
            snippet: line.trim(),
          });
        }
      }
    }

    braceDepth += opens - closes;
    if (inEncFn && braceDepth <= braceDepthAtFnStart) {
      inEncFn = false;
      braceDepthAtFnStart = -1;
      currentFnLine = -1;
    }
  }

  // Avoid unused-var warning
  void lineNumber;
  void currentFnLine;
  return findings;
}
