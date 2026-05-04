/**
 * cleartext-checker.ts — detect on-chain leaks of plaintext derived from
 * encrypted handles.
 *
 * Patterns flagged (Solidity only):
 *  1. `require(...)` whose condition references a known decrypted value or
 *      whose error string interpolates a balance-like cleartext.
 *  2. `emit Foo(<arg>, ...)` where any argument was assigned from
 *      `FHE.decrypt(...)` (or a function that returns a decrypted value).
 *  3. Raw decrypt-then-emit pattern: a single statement chain where a
 *      decrypted value is emitted in the same function.
 *
 * Plan v1.1-skills audit, Task 3.
 */
import type { Finding } from "./report.ts";

interface DecryptedVar {
  name: string;
  declLine: number;
}

function collectDecryptedVars(source: string): DecryptedVar[] {
  const out: DecryptedVar[] = [];
  const lines = source.split("\n");
  // matches: `[type] name = FHE.decrypt(...)` OR `[type] name = decrypt(...)`
  const re =
    /^\s*(?:uint\d*|bool|address|bytes\d*)?\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:FHE\.)?decrypt\s*\(/;
  for (let i = 0; i < lines.length; i += 1) {
    const m = re.exec(lines[i] as string);
    if (m) {
      out.push({ name: m[1] as string, declLine: i + 1 });
    }
  }
  return out;
}

export function checkCleartext(file: string, source: string): Finding[] {
  if (!file.endsWith(".sol")) return [];
  const findings: Finding[] = [];
  const lines = source.split("\n");
  const decrypted = collectDecryptedVars(source);
  const decryptedNames = new Set(decrypted.map((d) => d.name));

  // 1. require(...) referencing a decrypted var or with leaky message
  const requireRe = /^\s*require\s*\(([^,)]+)(?:\s*,\s*"([^"]*)")?\s*\)\s*;/;
  for (let i = 0; i < lines.length; i += 1) {
    const m = requireRe.exec(lines[i] as string);
    if (!m) continue;
    const cond = (m[1] as string).trim();
    const message = (m[2] as string | undefined) ?? "";

    // Cond references decrypted variable
    const referencesDecrypted = [...decryptedNames].some((n) =>
      new RegExp(`\\b${n}\\b`).test(cond),
    );
    // Cond is itself FHE.decrypt(...)
    const inlineDecrypt = /\bFHE\.decrypt\s*\(/.test(cond) ||
      /\bdecrypt\s*\(/.test(cond);
    // Leaky message words
    const leakyMessage = /balance|amount|%d|plaintext|%s/i.test(message);

    if (referencesDecrypted || inlineDecrypt) {
      findings.push({
        file,
        line: i + 1,
        severity: "CRITICAL",
        category: "CLEARTEXT",
        rule: "cleartext-require-condition",
        message: `\`require()\` condition operates on decrypted plaintext (\`${cond}\`). On-chain reverts based on cleartext leak the value to anyone watching the mempool / failure logs.`,
        suggestion:
          "Compute the comparison as an `ebool` (`FHE.lt`/`FHE.eq`/...), `FHE.allow(cond, recipient)`, and decide off-chain via the relayer SDK; or use `FHE.select` to keep the branch encrypted.",
        snippet: (lines[i] as string).trim(),
      });
    } else if (leakyMessage) {
      findings.push({
        file,
        line: i + 1,
        severity: "WARNING",
        category: "CLEARTEXT",
        rule: "cleartext-require-message",
        message: `\`require()\` revert message hints at sensitive cleartext ("${message}"). Even if the condition is on plaintext input, log strings can confirm guess-and-check attacks.`,
        suggestion:
          "Use a generic, non-numeric error string (e.g. `\"unauthorized\"`, `\"input out of range\"`).",
        snippet: (lines[i] as string).trim(),
      });
    }
  }

  // 2. emit ... where an argument is a decrypted variable (or a direct decrypt call)
  const emitRe = /^\s*emit\s+(\w+)\s*\(([^;]*)\)\s*;/;
  for (let i = 0; i < lines.length; i += 1) {
    const m = emitRe.exec(lines[i] as string);
    if (!m) continue;
    const eventName = m[1] as string;
    const argsStr = m[2] as string;

    const inlineDecrypt =
      /\bFHE\.decrypt\s*\(/.test(argsStr) || /\bdecrypt\s*\(/.test(argsStr);
    const refDecrypted = [...decryptedNames].some((n) =>
      new RegExp(`\\b${n}\\b`).test(argsStr),
    );
    if (!inlineDecrypt && !refDecrypted) continue;

    findings.push({
      file,
      line: i + 1,
      severity: "CRITICAL",
      category: "CLEARTEXT",
      rule: "cleartext-emit-decrypted",
      message: `\`emit ${eventName}(...)\` includes a value derived from \`FHE.decrypt\`. Events are public — this destroys confidentiality.`,
      suggestion:
        "Emit only the *encrypted handle* (an opaque `bytes32`-shaped identifier) or omit the value entirely. Decrypt off-chain via the relayer SDK in the indexer/UI.",
      snippet: (lines[i] as string).trim(),
    });
  }

  // 3. raw decrypt-then-emit in same function (decrypt at line X, emit before next `function` keyword)
  // Approximation: any `FHE.decrypt(` followed within 8 lines by `emit` is suspicious even if vars don't link.
  for (let i = 0; i < lines.length; i += 1) {
    if (!/\bFHE\.decrypt\s*\(/.test(lines[i] as string)) continue;
    const window = lines.slice(i + 1, i + 9).join("\n");
    if (!/\bemit\s+\w+\s*\(/.test(window)) continue;
    // Skip if we already flagged the same line via pattern 2
    const already = findings.some(
      (f) => Math.abs(f.line - (i + 1)) <= 8 && f.rule === "cleartext-emit-decrypted",
    );
    if (already) continue;
    findings.push({
      file,
      line: i + 1,
      severity: "WARNING",
      category: "CLEARTEXT",
      rule: "cleartext-decrypt-then-emit",
      message:
        "Decrypt followed by `emit` in the same scope. Even if the emitted variable name does not literally match, this pattern almost always leaks plaintext to chain observers.",
      suggestion:
        "Move the `decrypt` off-chain (relayer SDK). On-chain, only handle ciphertexts; events should reference encrypted handles.",
      snippet: (lines[i] as string).trim(),
    });
  }

  return findings;
}
