/**
 * hcu-counter.ts — count FHE operations per function and warn when the
 * count exceeds heuristic thresholds.
 *
 * Thresholds (per function):
 *   - >12  -> WARNING (likely close to per-tx HCU budget)
 *   - >20  -> CRITICAL (very likely exceeds budget; will revert at runtime)
 *
 * Counted ops (via `FHE.<op>(`):
 *   add sub mul lt gt le ge eq ne select cmux and or xor not
 *
 * Reference: https://docs.zama.org/protocol/solidity-guides/development-guide/hcu
 *
 * Plan v1.1-skills audit, Task 4.
 */
import type { Finding } from "./report.ts";

const COUNTED_OPS = [
  "add",
  "sub",
  "mul",
  "lt",
  "gt",
  "le",
  "ge",
  "eq",
  "ne",
  "select",
  "cmux",
  "and",
  "or",
  "xor",
  "not",
];

const FHE_OP_RE = new RegExp(
  `\\bFHE\\.(?:${COUNTED_OPS.join("|")})\\s*\\(`,
  "g",
);

const WARN_THRESHOLD = 12;
const ERROR_THRESHOLD = 20;

interface FunctionRange {
  name: string;
  startLine: number; // 1-based
  endLine: number; // 1-based, inclusive
}

function findFunctions(source: string): FunctionRange[] {
  const lines = source.split("\n");
  const out: FunctionRange[] = [];
  const fnSigRe = /\bfunction\s+(\w+)\s*\(/;

  let inFn = false;
  let braceDepthAtFnStart = -1;
  let braceDepth = 0;
  let currentFnName = "";
  let currentFnStart = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] as string;
    const opens = (line.match(/\{/g) ?? []).length;
    const closes = (line.match(/\}/g) ?? []).length;

    if (!inFn) {
      const m = fnSigRe.exec(line);
      if (m) {
        // ensure function has a body (not abstract `;`)
        // we look for a `{` somewhere in this line or the next few
        const lookahead = lines.slice(i, Math.min(i + 5, lines.length)).join("\n");
        if (/\{/.test(lookahead) && !/\}\s*$/.test(line)) {
          inFn = true;
          currentFnName = m[1] as string;
          currentFnStart = i + 1;
          braceDepthAtFnStart = braceDepth;
        }
      }
    }

    braceDepth += opens - closes;

    if (inFn && braceDepth <= braceDepthAtFnStart) {
      out.push({
        name: currentFnName,
        startLine: currentFnStart,
        endLine: i + 1,
      });
      inFn = false;
      braceDepthAtFnStart = -1;
    }
  }

  return out;
}

export function checkHcu(file: string, source: string): Finding[] {
  if (!file.endsWith(".sol")) return [];
  const findings: Finding[] = [];
  const fns = findFunctions(source);
  const lines = source.split("\n");

  for (const fn of fns) {
    const body = lines.slice(fn.startLine - 1, fn.endLine).join("\n");
    const matches = body.match(FHE_OP_RE);
    const count = matches ? matches.length : 0;
    if (count <= WARN_THRESHOLD) continue;

    const severity = count > ERROR_THRESHOLD ? "CRITICAL" : "WARNING";
    findings.push({
      file,
      line: fn.startLine,
      severity,
      category: "HCU",
      rule:
        count > ERROR_THRESHOLD
          ? "hcu-explosion-error"
          : "hcu-explosion-warning",
      message: `Function \`${fn.name}\` calls ${count} FHE ops in a single transaction (threshold: warn>${WARN_THRESHOLD}, error>${ERROR_THRESHOLD}). FHE ops are HCU-priced and are likely to exceed the per-tx budget.`,
      suggestion:
        "Split the pipeline into multiple transactions (caller-driven), cache intermediate ciphertexts in storage with `FHE.allowThis`, or precompute parts off-chain. See https://docs.zama.org/protocol/solidity-guides/development-guide/hcu for the current HCU table.",
      snippet: `function ${fn.name} (${count} FHE ops, lines ${fn.startLine}-${fn.endLine})`,
    });
  }

  return findings;
}
