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

  // 3b. requestDecryption callback that re-leaks plaintext.
  //   In @fhevm/solidity 0.11.x decryption is async: `FHE.requestDecryption(handles, callbackSelector)`
  //   then an oracle calls back with `(uint256 requestId, bytes calldata cleartexts, bytes calldata proof)`.
  //   The callback body must NOT emit() those cleartexts nor store them in a public mapping —
  //   the whole point of doing this off-chain is keeping them off-chain. Flag when it does.
  const fnHeaderRe =
    /\bfunction\s+([A-Za-z_]\w*Callback|[Oo]nDecrypted\w*|[Cc]allback\w*|fulfillDecryption\w*)\s*\(([^)]*)\)/;
  for (let i = 0; i < lines.length; i += 1) {
    const header = fnHeaderRe.exec(lines[i] as string);
    if (!header) continue;
    const params = header[2] as string;
    // Identify the cleartext/plain parameter name(s) — anything bytes / uint that isn't requestId / proof.
    const paramNames = params
      .split(",")
      .map((p) => p.trim().split(/\s+/).pop() ?? "")
      .filter((n) => n && !/^(?:requestId|proof|signatures?)$/i.test(n));
    if (paramNames.length === 0) continue;
    // Walk the body until matching close-brace at the function-declaration depth.
    let depth = 0;
    let started = false;
    for (let j = i; j < lines.length; j += 1) {
      const line = lines[j] as string;
      const opens = (line.match(/\{/g) ?? []).length;
      const closes = (line.match(/\}/g) ?? []).length;
      depth += opens - closes;
      if (opens > 0) started = true;
      if (started && depth === 0 && j > i) break;
      if (j === i) continue;
      // emit ... (...)
      const em = /\bemit\s+\w+\s*\(([^;]*)\)/.exec(line);
      if (em) {
        const emArgs = em[1] as string;
        const leaked = paramNames.find((p) => new RegExp(`\\b${p}\\b`).test(emArgs));
        if (leaked) {
          findings.push({
            file,
            line: j + 1,
            severity: "CRITICAL",
            category: "CLEARTEXT",
            rule: "cleartext-callback-emit",
            message: `Decryption callback \`${header[1] ?? "callback"}\` emits its cleartext parameter \`${leaked}\` in an event. Events are public — this defeats off-chain decryption entirely.`,
            suggestion:
              "Do not emit the decrypted plaintext. Forward the requestId / handle to the off-chain consumer (relayer SDK / indexer) and emit only the request reference.",
            snippet: line.trim(),
          });
        }
      }
      // Storage write to a `public` field: <name>[...] = <param>
      const sw = /^\s*([A-Za-z_]\w*)\s*\[[^\]]*\]\s*=\s*([A-Za-z_]\w*)\s*;/.exec(line);
      if (sw) {
        const target = sw[1] as string;
        const value = sw[2] as string;
        if (paramNames.includes(value)) {
          findings.push({
            file,
            line: j + 1,
            severity: "WARNING",
            category: "CLEARTEXT",
            rule: "cleartext-callback-store",
            message: `Decryption callback writes plaintext \`${value}\` into storage slot \`${target}\`. If \`${target}\` is \`public\`, the auto-generated getter exposes the cleartext.`,
            suggestion: `Make sure \`${target}\` is \`private\`/\`internal\` and gated by an explicit caller check, or restructure so the cleartext stays off-chain.`,
            snippet: line.trim(),
          });
        }
      }
    }
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
