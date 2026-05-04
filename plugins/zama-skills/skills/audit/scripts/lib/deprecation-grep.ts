/**
 * deprecation-grep.ts — hard-error on deprecated package imports.
 *
 * Solidity (`.sol`):
 *   - `import "fhevm/...";` (root `fhevm` package) — replace with `@fhevm/solidity`.
 *
 * TypeScript / JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`):
 *   - `from "fhevmjs"` / `from 'fhevmjs'` / `require("fhevmjs")` — replace with `@zama-fhe/relayer-sdk`.
 *   - `from "fhevm"` / `require("fhevm")` (root, NOT `@fhevm/solidity`) — replace with `@fhevm/solidity`.
 *
 * Reads the canonical deprecation list from `shared/deprecated-imports.json`
 * if available; otherwise falls back to the in-source mapping below.
 *
 * Plan v1.1-skills audit, Task 5.
 */
import type { Finding } from "./report.ts";

interface DeprecationEntry {
  pkg: string;
  replacement: string;
  notes: string;
}

const FALLBACK_DEPRECATIONS: DeprecationEntry[] = [
  {
    pkg: "fhevmjs",
    replacement: "@zama-fhe/relayer-sdk",
    notes:
      "Officially deprecated 2025-07-10. Use @zama-fhe/relayer-sdk in the frontend.",
  },
  {
    pkg: "fhevm",
    replacement: "@fhevm/solidity",
    notes:
      "Root fhevm package deprecated 2025-07-10. Use @fhevm/solidity for Solidity-side primitives.",
  },
];

function isCodeFile(file: string): boolean {
  return /\.(sol|ts|tsx|js|jsx|mjs|cjs)$/.test(file);
}

const TS_EXT_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function checkDeprecations(
  file: string,
  source: string,
  deprecations: DeprecationEntry[] = FALLBACK_DEPRECATIONS,
): Finding[] {
  if (!isCodeFile(file)) return [];
  const findings: Finding[] = [];
  const lines = source.split("\n");

  for (const dep of deprecations) {
    const escPkg = escapeRegex(dep.pkg);
    let detector: RegExp;

    if (file.endsWith(".sol")) {
      // Solidity import: import "fhevm/..." or import {X} from "fhevm/..."
      detector = new RegExp(
        `\\bimport\\b[^;]*["']${escPkg}(?:/[^"']*)?["']`,
      );
    } else if (TS_EXT_RE.test(file)) {
      // TS/JS: from "pkg" or from "pkg/sub" or require("pkg")
      detector = new RegExp(
        `(?:from\\s+["']${escPkg}(?:/[^"']*)?["']|require\\s*\\(\\s*["']${escPkg}(?:/[^"']*)?["']\\s*\\))`,
      );
    } else {
      continue;
    }

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] as string;
      // Skip comments
      if (/^\s*(?:\/\/|\*|\/\*)/.test(line)) continue;
      // Avoid false positives where pkg is a substring of another pkg
      // (e.g. `fhevm` is substring of `@fhevm/solidity`). The detectors above
      // are anchored on bare quotes, so this is mostly handled — but
      // `fhevm` as a substring of `fhevmjs` would also match the `fhevm`
      // detector. We special-case: if scanning for `fhevm`, ensure the
      // matched package is exactly `fhevm` (not `fhevmjs`).
      if (dep.pkg === "fhevm") {
        const exact = new RegExp(
          `["']fhevm(?:/[^"']*)?["']`,
        );
        if (!exact.test(line)) continue;
      }
      if (!detector.test(line)) continue;

      findings.push({
        file,
        line: i + 1,
        severity: "CRITICAL",
        category: "DEPRECATED",
        rule: `deprecated-import-${dep.pkg}`,
        message: `Deprecated package \`${dep.pkg}\` imported. ${dep.notes}`,
        suggestion: file.endsWith(".sol")
          ? `Replace with: import {FHE, euint64, ebool} from "${dep.replacement}/lib/FHE.sol";  (run: pnpm remove ${dep.pkg} && pnpm add ${dep.replacement})`
          : `Replace with: import { ... } from "${dep.replacement}";  (run: pnpm remove ${dep.pkg} && pnpm add ${dep.replacement})`,
        snippet: line.trim(),
      });
    }
  }

  return findings;
}

export type { DeprecationEntry };
export { FALLBACK_DEPRECATIONS };
