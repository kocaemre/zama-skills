import { describe, it, expect, beforeEach } from "vitest";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getVersion,
  isDeprecated,
  loadVersions,
  loadDeprecated,
  getCompilerVersion,
  listAllPackages,
  VersionsSchema,
  DeprecatedSchema,
  _resetCache,
} from "./versions.js";

beforeEach(() => {
  _resetCache();
});

describe("getVersion", () => {
  it("returns caret-ranged version for @fhevm/solidity", () => {
    expect(getVersion("@fhevm/solidity")).toBe("^0.11.1");
  });

  it("returns exact version for @fhevm/mock-utils (no caret)", () => {
    expect(getVersion("@fhevm/mock-utils")).toBe("0.4.2");
  });

  it("throws clear error when package missing", () => {
    expect(() => getVersion("nonexistent-pkg")).toThrow(
      /not found in pinned-versions\.json/i,
    );
  });
});

describe("isDeprecated", () => {
  it("returns true with replacement for fhevmjs", () => {
    const r = isDeprecated("fhevmjs");
    expect(r.deprecated).toBe(true);
    expect(r.replaces).toBe("@zama-fhe/relayer-sdk");
  });

  it("returns true with replacement for fhevm root pkg", () => {
    const r = isDeprecated("fhevm");
    expect(r.deprecated).toBe(true);
    expect(r.replaces).toBe("@fhevm/solidity");
  });

  it("returns false for non-deprecated package", () => {
    expect(isDeprecated("@fhevm/solidity").deprecated).toBe(false);
  });
});

describe("getCompilerVersion", () => {
  it("returns 0.8.27", () => {
    expect(getCompilerVersion()).toBe("0.8.27");
  });
});

describe("listAllPackages", () => {
  it("includes core fhEVM packages", () => {
    const all = listAllPackages();
    expect(all).toContain("@fhevm/solidity");
    expect(all).toContain("@fhevm/hardhat-plugin");
    expect(all).toContain("@zama-fhe/relayer-sdk");
    expect(all).toContain("@openzeppelin/confidential-contracts");
  });
});

describe("loadVersions schema validation", () => {
  it("throws on schema violation (missing version field)", () => {
    const dir = mkdtempSync(join(tmpdir(), "versions-test-"));
    const bad = join(dir, "bad.json");
    writeFileSync(
      bad,
      JSON.stringify({
        packages: { foo: { notes: "no version field" } },
        compiler: { solc: "0.8.27" },
        node: ">=20",
        typescript: "^5.9.3",
      }),
    );
    expect(() => loadVersions(bad)).toThrow();
  });

  it("loads valid fixture", () => {
    const dir = mkdtempSync(join(tmpdir(), "versions-test-"));
    const good = join(dir, "good.json");
    writeFileSync(
      good,
      JSON.stringify({
        packages: { foo: { version: "^1.0.0" } },
        compiler: { solc: "0.8.27" },
        node: ">=20",
        typescript: "^5.9.3",
      }),
    );
    const v = loadVersions(good);
    expect(v.packages.foo.version).toBe("^1.0.0");
  });
});

describe("loadDeprecated schema validation", () => {
  it("loads canonical deprecated-imports.json", () => {
    const d = loadDeprecated();
    expect(d.deprecated.fhevmjs.replaces).toBe("@zama-fhe/relayer-sdk");
    expect(d.incompatible["hardhat@^3"].useInstead).toBe("hardhat@^2.28.4");
  });
});

describe("schemas exported", () => {
  it("VersionsSchema and DeprecatedSchema are zod schemas", () => {
    expect(typeof VersionsSchema.parse).toBe("function");
    expect(typeof DeprecatedSchema.parse).toBe("function");
  });
});
