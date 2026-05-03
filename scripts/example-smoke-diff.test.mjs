// scripts/example-smoke-diff.test.mjs
// Vitest unit tests for the smoke-diff driver. Synthetic fixtures only —
// the real CI run (Task 2) exercises end-to-end behavior against the committed example.

import { describe, it, expect } from "vitest";
import {
  validateAllowlist,
  stripAllowlistedLines,
  normalizePackageJsonSubtree,
  checkStructuralInvariants,
  checkPinnedVersionsSatisfied,
  diffNormalized,
} from "./example-smoke-diff.mjs";

const SEED_ALLOWLIST = {
  comment: "test",
  patterns: [
    {
      file: "a.sol",
      regex: "^// HCU budget: .+$",
      reason: "version-tagged HCU comment",
    },
    {
      file: "pkg.json",
      regex: "\"version\":\\s*\"[^\"]+\"",
      reason: "version field auto-bumps",
    },
  ],
  package_json_subtree_keys: ["dependencies", "devDependencies"],
  structural_invariants: {},
  pinned_version_check: {
    package_json: "pkg.json",
    must_satisfy_pinned_versions: [],
  },
};

describe("validateAllowlist", () => {
  it("accepts a well-formed allowlist", () => {
    expect(() => validateAllowlist(SEED_ALLOWLIST)).not.toThrow();
  });

  it("throws on missing comment field", () => {
    const bad = { ...SEED_ALLOWLIST, comment: undefined };
    expect(() => validateAllowlist(bad)).toThrow(/comment/);
  });

  it("throws on missing patterns array", () => {
    const bad = { ...SEED_ALLOWLIST, patterns: undefined };
    expect(() => validateAllowlist(bad)).toThrow(/patterns/);
  });

  it("throws on bogus regex (fail-fast at startup)", () => {
    const bad = {
      ...SEED_ALLOWLIST,
      patterns: [{ file: "x", regex: "[unterminated", reason: "n/a" }],
    };
    expect(() => validateAllowlist(bad)).toThrow(/regex|pattern/i);
  });
});

describe("stripAllowlistedLines", () => {
  it("removes lines matching the file's allowlist regexes", () => {
    const content = [
      "// HCU budget: 20M",
      "pragma solidity 0.8.27;",
      "// other comment",
    ].join("\n");
    const out = stripAllowlistedLines(content, "a.sol", SEED_ALLOWLIST);
    expect(out).not.toMatch(/HCU budget/);
    expect(out).toMatch(/pragma solidity 0\.8\.27/);
    expect(out).toMatch(/other comment/);
  });

  it("does not touch files with no matching pattern", () => {
    const content = "line1\n// HCU budget: 20M\nline3";
    const out = stripAllowlistedLines(content, "untracked.sol", SEED_ALLOWLIST);
    expect(out).toBe(content);
  });

  it("strips multiple matches across a file", () => {
    const content = '{"version": "1.0.0",\n"version": "2.0.0",\n"name":"foo"}';
    const out = stripAllowlistedLines(content, "pkg.json", SEED_ALLOWLIST);
    expect(out).not.toMatch(/"version"/);
    expect(out).toMatch(/"name":"foo"/);
  });
});

describe("normalizePackageJsonSubtree", () => {
  it("extracts only dependencies + devDependencies, sorted", () => {
    const pkg = {
      name: "foo",
      private: true,
      version: "9.9.9",
      scripts: { test: "vitest" },
      dependencies: { b: "1", a: "2" },
      devDependencies: { z: "3", y: "4" },
    };
    const out = normalizePackageJsonSubtree(JSON.stringify(pkg), [
      "dependencies",
      "devDependencies",
    ]);
    const parsed = JSON.parse(out);
    expect(parsed).toEqual({
      dependencies: { a: "2", b: "1" },
      devDependencies: { y: "4", z: "3" },
    });
    // Sort assertion: keys serialize in alphabetical order
    expect(out.indexOf('"a"')).toBeLessThan(out.indexOf('"b"'));
    expect(out.indexOf('"y"')).toBeLessThan(out.indexOf('"z"'));
  });

  it("produces identical normalized output regardless of input key order", () => {
    const a = JSON.stringify({
      dependencies: { x: "1", a: "2" },
      devDependencies: { z: "1" },
    });
    const b = JSON.stringify({
      devDependencies: { z: "1" },
      dependencies: { a: "2", x: "1" },
    });
    expect(normalizePackageJsonSubtree(a, ["dependencies", "devDependencies"])).toBe(
      normalizePackageJsonSubtree(b, ["dependencies", "devDependencies"]),
    );
  });

  it("treats missing subtree as empty object (not error)", () => {
    const pkg = { name: "foo", dependencies: { a: "1" } };
    const out = normalizePackageJsonSubtree(JSON.stringify(pkg), [
      "dependencies",
      "devDependencies",
    ]);
    const parsed = JSON.parse(out);
    expect(parsed.devDependencies).toEqual({});
  });
});

describe("checkStructuralInvariants", () => {
  const invariants = {
    license: "BSD-3-Clause-Clear|MIT",
    pragma: "0\\.8\\.(2[4-9]|[3-9][0-9])",
    required_imports: ["@fhevm/solidity/lib/FHE.sol"],
    forbidden_imports: ["fhevmjs", "^fhevm/"],
  };

  it("passes for a well-formed Token.sol", () => {
    const content = [
      "// SPDX-License-Identifier: BSD-3-Clause-Clear",
      "pragma solidity 0.8.27;",
      "import {FHE} from \"@fhevm/solidity/lib/FHE.sol\";",
      "contract Token {}",
    ].join("\n");
    const violations = checkStructuralInvariants(content, invariants);
    expect(violations).toEqual([]);
  });

  it("flags missing required import", () => {
    const content = [
      "// SPDX-License-Identifier: MIT",
      "pragma solidity 0.8.27;",
      "contract X {}",
    ].join("\n");
    const violations = checkStructuralInvariants(content, invariants);
    expect(violations.join("\n")).toMatch(/required import.*FHE\.sol/i);
  });

  it("flags forbidden import (deprecated fhevmjs)", () => {
    const content = [
      "// SPDX-License-Identifier: MIT",
      "pragma solidity 0.8.27;",
      "import {FHE} from \"@fhevm/solidity/lib/FHE.sol\";",
      "import 'fhevmjs';",
      "contract X {}",
    ].join("\n");
    const violations = checkStructuralInvariants(content, invariants);
    expect(violations.join("\n")).toMatch(/forbidden.*fhevmjs/i);
  });

  it("flags wrong pragma version (too old)", () => {
    const content = [
      "// SPDX-License-Identifier: MIT",
      "pragma solidity 0.8.20;",
      "import {FHE} from \"@fhevm/solidity/lib/FHE.sol\";",
      "contract X {}",
    ].join("\n");
    const violations = checkStructuralInvariants(content, invariants);
    expect(violations.join("\n")).toMatch(/pragma/i);
  });

  it("supports required_substrings (for hardhat.config.ts)", () => {
    const inv = {
      required_substrings: ["chainId: 11155111", "version: \"0.8.27\""],
    };
    const ok = checkStructuralInvariants(
      "const c = { chainId: 11155111, solidity: { version: \"0.8.27\" } };",
      inv,
    );
    expect(ok).toEqual([]);
    const bad = checkStructuralInvariants(
      "const c = { chainId: 11155111 };",
      inv,
    );
    expect(bad.join("\n")).toMatch(/0\.8\.27/);
  });
});

describe("checkPinnedVersionsSatisfied", () => {
  const pinned = {
    packages: {
      "@fhevm/solidity": { version: "^0.11.1" },
      "@fhevm/hardhat-plugin": { version: "^0.4.2" },
      "@fhevm/mock-utils": { version: "0.4.2", exact: true },
    },
  };

  it("passes when example dep matches pinned semver string exactly", () => {
    const pkg = {
      dependencies: { "@fhevm/solidity": "^0.11.1" },
      devDependencies: {
        "@fhevm/hardhat-plugin": "^0.4.2",
        "@fhevm/mock-utils": "0.4.2",
      },
    };
    const violations = checkPinnedVersionsSatisfied(JSON.stringify(pkg), pinned, [
      "@fhevm/solidity",
      "@fhevm/hardhat-plugin",
      "@fhevm/mock-utils",
    ]);
    expect(violations).toEqual([]);
  });

  it("flags version mismatch", () => {
    const pkg = {
      dependencies: { "@fhevm/solidity": "^0.10.0" },
    };
    const violations = checkPinnedVersionsSatisfied(JSON.stringify(pkg), pinned, [
      "@fhevm/solidity",
    ]);
    expect(violations.join("\n")).toMatch(/@fhevm\/solidity/);
    expect(violations.join("\n")).toMatch(/0\.11\.1/);
  });

  it("flags missing required dep", () => {
    const pkg = { dependencies: {} };
    const violations = checkPinnedVersionsSatisfied(JSON.stringify(pkg), pinned, [
      "@fhevm/solidity",
    ]);
    expect(violations.join("\n")).toMatch(/missing/i);
  });
});

describe("diffNormalized", () => {
  it("returns empty diff when post-normalization contents match", () => {
    const a = "// HCU budget: 20M\npragma solidity 0.8.27;";
    const b = "// HCU budget: 30M\npragma solidity 0.8.27;";
    const result = diffNormalized(a, b, "a.sol", SEED_ALLOWLIST);
    expect(result).toBe("");
  });

  it("returns a unified-style diff when content differs after normalization", () => {
    const a = "pragma solidity 0.8.27;\ncontract A {}";
    const b = "pragma solidity 0.8.27;\ncontract B {}";
    const result = diffNormalized(a, b, "a.sol", SEED_ALLOWLIST);
    expect(result).toMatch(/contract A/);
    expect(result).toMatch(/contract B/);
  });
});
