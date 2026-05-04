/**
 * diagnose.test.ts — vitest suite for the /zama-debug pattern engine.
 *
 * One test per registered pattern (10), plus engine + CLI smoke tests, and
 * a CI cross-check that PATTERNS.md mirrors the patterns.ts catalog.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PATTERNS, PATTERN_COUNT } from "./lib/patterns.ts";
import { diagnose, renderDiagnosis } from "./lib/matcher.ts";
import { run } from "./diagnose.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------- patterns catalog ----------------

describe("patterns catalog", () => {
  it("registers exactly 10 patterns (extend deliberately)", () => {
    expect(PATTERN_COUNT).toBe(10);
    expect(PATTERNS.length).toBe(10);
  });

  it("each pattern has stable structure", () => {
    for (const p of PATTERNS) {
      expect(p.name).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.label.length).toBeLessThanOrEqual(120);
      expect(p.pattern).toBeInstanceOf(RegExp);
      expect(p.cause.length).toBeGreaterThan(20);
      expect(Array.isArray(p.fix)).toBe(true);
      expect(p.fix.length).toBeGreaterThan(0);
      expect(p.reference.length).toBeGreaterThan(0);
    }
  });

  it("has unique pattern names", () => {
    const names = PATTERNS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

// ---------------- per-pattern matching ----------------

const SAMPLES: Record<string, string> = {
  "acl-not-allowed":
    "Error: VM Exception while processing transaction: reverted with reason string 'ACL: not allowed'",
  "relayer-sdk-bundle-import":
    "TypeError: Cannot read properties of undefined (reading 'initSDK')\n    at app.tsx:14",
  "deprecated-fhevmjs":
    "Module not found: Error: Can't resolve 'fhevmjs' in '/app/src'",
  "deprecated-fhevm-root":
    "ParserError: Source \"fhevm/lib/TFHE.sol\" not found: Cannot find module 'fhevm'",
  "hcu-exceeded":
    "Error: Transaction reverted: HCU exceeded — homomorphic compute units budget of 20M reached.",
  "next-indexeddb-ssr":
    "Warning: BAILOUT_TO_CLIENT_SIDE_RENDERING\nReferenceError: indexedDB is not defined",
  "etherscan-v1-deprecated":
    "Error from Etherscan: V1 endpoint deprecated. Please migrate to https://api.etherscan.io/v2",
  "relayer-timeout":
    "FetchError: relayer 502 Bad Gateway when calling https://relayer.testnet.zama.cloud/v1/decrypt",
  "wagmi-undefined-readcontract":
    "ContractFunctionExecutionError: The contract function \"balanceOf\" reverted. Function selector 0xabcdef not found on ABI.",
  "zama-config-not-found":
    "ParserError: Identifier 'ZamaEthereumConfig' not found. Did you forget to import @fhevm/solidity/config/ZamaConfig.sol ?",
};

describe("diagnose() — one sample per pattern", () => {
  for (const p of PATTERNS) {
    it(`matches ${p.name}`, () => {
      const sample = SAMPLES[p.name];
      expect(sample, `missing sample for ${p.name}`).toBeTruthy();
      const r = diagnose(sample);
      expect(r.matched).toBe(true);
      if (r.matched) {
        expect(r.pattern.name).toBe(p.name);
      }
    });
  }
});

// ---------------- engine edge cases ----------------

describe("diagnose() edge cases", () => {
  it("returns no-match on empty input", () => {
    expect(diagnose("").matched).toBe(false);
    expect(diagnose("   \n\t").matched).toBe(false);
  });

  it("returns no-match on unrelated error text", () => {
    const r = diagnose("ENOENT: no such file or directory, open 'foo.txt'");
    expect(r.matched).toBe(false);
  });

  it("ignores non-string input gracefully", () => {
    // @ts-expect-error — intentional bad input
    expect(diagnose(undefined).matched).toBe(false);
    // @ts-expect-error — intentional bad input
    expect(diagnose(null).matched).toBe(false);
  });

  it("renders a markdown diagnosis with cause + fix + reference", () => {
    const r = diagnose(SAMPLES["acl-not-allowed"]);
    const md = renderDiagnosis(r);
    expect(md).toContain("## /zama-debug — ");
    expect(md).toContain("### Likely cause");
    expect(md).toContain("### Fix");
    expect(md).toContain("### Reference");
  });

  it("renders no-match guidance on miss", () => {
    const md = renderDiagnosis({ matched: false });
    expect(md).toContain("no match");
    expect(md).toContain("Re-paste");
  });
});

// ---------------- CLI run() ----------------

describe("run() CLI driver", () => {
  it("matches via --error", () => {
    const r = run({
      argv: ["--error", SAMPLES["deprecated-fhevmjs"]],
      stdin: "",
    });
    expect(r.exitCode).toBe(0);
    expect(r.output).toContain("deprecated-fhevmjs");
  });

  it("falls back to stdin", () => {
    const r = run({ argv: [], stdin: SAMPLES["hcu-exceeded"] });
    expect(r.exitCode).toBe(0);
    expect(r.output).toContain("HCU");
  });

  it("exits 1 on no-match", () => {
    const r = run({ argv: ["--error", "totally unrelated"], stdin: "" });
    expect(r.exitCode).toBe(1);
    expect(r.output).toContain("no match");
  });

  it("exits 2 on missing input", () => {
    const r = run({ argv: [], stdin: "" });
    expect(r.exitCode).toBe(2);
  });
});

// ---------------- PATTERNS.md cross-check ----------------

describe("PATTERNS.md mirror", () => {
  it("contains a heading for every pattern name", () => {
    const mdPath = resolve(__dirname, "..", "assets", "PATTERNS.md");
    const md = readFileSync(mdPath, "utf8");
    for (const p of PATTERNS) {
      expect(md, `PATTERNS.md missing entry for ${p.name}`).toContain(`### ${p.name}`);
    }
  });

  it("declares the same pattern count in the catalog header", () => {
    const mdPath = resolve(__dirname, "..", "assets", "PATTERNS.md");
    const md = readFileSync(mdPath, "utf8");
    expect(md).toMatch(new RegExp(`Patterns registered:\\s*\\*\\*${PATTERN_COUNT}\\*\\*`));
  });
});
