/**
 * preflight-shared.test.ts — Tests for shared preflight + closing-summary helpers.
 *
 * Plan 04-05. Covers:
 *   - detectWorkspace in a synthetic /zama-init'd dir → returns root + flags
 *   - detectWorkspace in an empty tmp dir → null root, all flags false
 *   - checkPnpm: true for `pnpm`, false for non-existent binary
 *   - readPkgJson on missing file → null; on valid file → parsed object
 *   - renderClosingSummary('contract', {name:'Counter'}) → contains 'Counter' + '/zama-test'
 *   - renderClosingSummary on unknown skill → throws
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  detectWorkspace,
  checkPnpm,
  readPkgJson,
} from "./preflight-shared.js";
import { renderClosingSummary } from "./closing-summary.js";

describe("detectWorkspace", () => {
  let workspaceDir: string;
  let emptyDir: string;

  beforeAll(() => {
    // Build a synthetic workspace
    workspaceDir = mkdtempSync(join(tmpdir(), "zama-ws-"));
    writeFileSync(join(workspaceDir, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
    mkdirSync(join(workspaceDir, "packages", "contracts"), { recursive: true });
    mkdirSync(join(workspaceDir, "packages", "frontend"), { recursive: true });
    // Empty dir
    emptyDir = mkdtempSync(join(tmpdir(), "zama-empty-"));
  });

  afterAll(() => {
    rmSync(workspaceDir, { recursive: true, force: true });
    rmSync(emptyDir, { recursive: true, force: true });
  });

  it("detects workspace + packages in a /zama-init'd dir", () => {
    const result = detectWorkspace(workspaceDir);
    expect(result.root).toBe(workspaceDir);
    expect(result.hasPackagesContracts).toBe(true);
    expect(result.hasPackagesFrontend).toBe(true);
  });

  it("walks up from a nested subdir and still finds the workspace root", () => {
    const nested = join(workspaceDir, "packages", "contracts");
    const result = detectWorkspace(nested);
    expect(result.root).toBe(workspaceDir);
  });

  it("returns null root + false flags in empty dir", () => {
    const result = detectWorkspace(emptyDir);
    expect(result.root).toBeNull();
    expect(result.hasPackagesContracts).toBe(false);
    expect(result.hasPackagesFrontend).toBe(false);
    expect(result.isPnpm).toBe(false);
  });
});

describe("checkPnpm", () => {
  it("returns true when pnpm is on PATH (or false if not)", () => {
    // We don't strictly require pnpm in CI for this test; we only ensure
    // the function returns a boolean and never throws.
    const result = checkPnpm();
    expect(typeof result).toBe("boolean");
  });

  it("returns false for a guaranteed-missing binary", () => {
    const result = checkPnpm("definitely-not-a-real-binary-xxx-zama");
    expect(result).toBe(false);
  });
});

describe("readPkgJson", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "zama-pkg-"));
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "demo",
        version: "1.2.3",
        dependencies: { foo: "1.0.0" },
      }),
    );
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns parsed object for a valid file", () => {
    const result = readPkgJson(join(dir, "package.json"));
    expect(result).not.toBeNull();
    expect(result?.name).toBe("demo");
    expect(result?.version).toBe("1.2.3");
    expect(result?.dependencies?.foo).toBe("1.0.0");
  });

  it("returns null for a missing file", () => {
    const result = readPkgJson(join(dir, "does-not-exist.json"));
    expect(result).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    const bad = join(dir, "bad.json");
    writeFileSync(bad, "{ not json");
    const result = readPkgJson(bad);
    expect(result).toBeNull();
  });
});

describe("renderClosingSummary", () => {
  it("renders the contract fragment with name + /zama-test pointer", () => {
    const out = renderClosingSummary("contract", {
      name: "Counter",
      path: "packages/contracts/contracts/Counter.sol",
      aclCount: "3",
    });
    expect(out).toContain("Counter");
    expect(out).toContain("/zama-test");
  });

  it("renders the test fragment with /zama-deploy pointer", () => {
    const out = renderClosingSummary("test", {
      name: "Counter",
      mockPath: "packages/contracts/test/Counter.test.ts",
      sepoliaPath: "packages/contracts/test/Counter.sepolia.test.ts",
      aclAssertCount: "2",
    });
    expect(out).toContain("/zama-deploy");
  });

  it("renders the deploy fragment with /zama-frontend pointer", () => {
    const out = renderClosingSummary("deploy", {
      address: "0xabc",
      etherscanUrl: "https://sepolia.etherscan.io/address/0xabc",
      verifyStatus: "verified",
      registryStatus: "n/a",
      abiPath: "packages/frontend/src/abis/Counter.json",
      NAME_UPPER: "COUNTER",
    });
    expect(out).toContain("/zama-frontend");
    expect(out).toContain("0xabc");
  });

  it("renders the frontend fragment with ship message", () => {
    const out = renderClosingSummary("frontend", {
      libPath: "src/lib/fhe.ts",
      hookPath: "src/hooks/useDecrypted.ts",
      componentPath: "src/components/EncryptedInput.tsx",
      withWagmi: "false",
    });
    expect(out.toLowerCase()).toContain("ship");
  });

  it("throws on unknown skill", () => {
    expect(() =>
      // @ts-expect-error intentional invalid input for runtime check
      renderClosingSummary("unknown", {}),
    ).toThrow();
  });

  it("keeps unknown placeholders visible (does not blank them out)", () => {
    const out = renderClosingSummary("contract", { name: "X" });
    // {{path}} was not provided — must remain as literal so users see it
    expect(out).toContain("{{path}}");
  });
});
