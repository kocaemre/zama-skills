/**
 * generate.test.ts — vitest suite for /zama-test generator and preflight.
 *
 * Plan 04-02 — covers behaviors:
 *  - generate({contract:"Counter"}) writes both mock + sepolia tests
 *  - mock template includes createEncryptedInput + userDecryptEuint + ACL re-decrypt
 *  - sepolia template includes network.name guard + HCU header + createInstance(SepoliaConfig)
 *  - ethers v6 syntax only (no BigNumber.from / fhevmjs / ethers@^5)
 *  - preflight refuses ethers v5
 *  - preflight refuses missing target contract
 *  - second generate without --force aborts (file exists)
 */

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { generateTests } from "./generate.js";
import { runTestPreflight } from "./lib/preflight.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_COUNTER = join(__dirname, "__fixtures__", "Counter.sol");

interface Workspace {
  root: string;
  contractsDir: string;
  testDir: string;
  pkgPath: string;
}

function makeWorkspace(opts: { ethersVersion?: string; typechainV5?: boolean; withCounter?: boolean } = {}): Workspace {
  const root = mkdtempSync(join(tmpdir(), "zama-test-"));
  const contractsDir = join(root, "packages", "contracts", "contracts");
  const testDir = join(root, "packages", "contracts", "test");
  mkdirSync(contractsDir, { recursive: true });
  mkdirSync(testDir, { recursive: true });

  const deps: Record<string, string> = { ethers: opts.ethersVersion ?? "^6.16.0" };
  if (opts.typechainV5) deps["@typechain/ethers-v5"] = "^11.1.2";
  const pkgPath = join(root, "packages", "contracts", "package.json");
  writeFileSync(pkgPath, JSON.stringify({ name: "contracts", devDependencies: deps }, null, 2));

  if (opts.withCounter !== false) {
    copyFileSync(FIXTURE_COUNTER, join(contractsDir, "Counter.sol"));
  }
  return { root, contractsDir, testDir, pkgPath };
}

function cleanup(ws: Workspace) {
  try { rmSync(ws.root, { recursive: true, force: true }); } catch { /* ignore */ }
}

describe("preflight", () => {
  let ws: Workspace;
  afterEach(() => ws && cleanup(ws));

  it("passes when ethers v6 + contract exists", async () => {
    ws = makeWorkspace();
    const result = await runTestPreflight({ cwd: ws.root, contract: "Counter" });
    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("refuses ethers v5", async () => {
    ws = makeWorkspace({ ethersVersion: "^5.7.2" });
    const result = await runTestPreflight({ cwd: ws.root, contract: "Counter" });
    expect(result.ok).toBe(false);
    expect(result.failures.join(" ")).toMatch(/ethers v5 detected; \/zama-test requires ethers v6/);
  });

  it("refuses @typechain/ethers-v5", async () => {
    ws = makeWorkspace({ typechainV5: true });
    const result = await runTestPreflight({ cwd: ws.root, contract: "Counter" });
    expect(result.ok).toBe(false);
    expect(result.failures.join(" ")).toMatch(/typechain.*v5|ethers v5/i);
  });

  it("refuses missing target contract", async () => {
    ws = makeWorkspace({ withCounter: false });
    const result = await runTestPreflight({ cwd: ws.root, contract: "Counter" });
    expect(result.ok).toBe(false);
    expect(result.failures.join(" ")).toMatch(/Counter\.sol not found in packages\/contracts\/contracts\//);
  });

  it("refuses missing workspace", async () => {
    const root = mkdtempSync(join(tmpdir(), "zama-test-empty-"));
    try {
      const result = await runTestPreflight({ cwd: root, contract: "Counter" });
      expect(result.ok).toBe(false);
      expect(result.failures.join(" ")).toMatch(/Run \/zama-init first/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("generateTests", () => {
  let ws: Workspace;
  afterEach(() => ws && cleanup(ws));

  it("writes mock + sepolia files for Counter.sol", async () => {
    ws = makeWorkspace();
    const result = await generateTests({ cwd: ws.root, contract: "Counter" });
    expect(result.written).toHaveLength(2);
    const mock = join(ws.testDir, "Counter.test.ts");
    const sepolia = join(ws.testDir, "Counter.sepolia.test.ts");
    expect(existsSync(mock)).toBe(true);
    expect(existsSync(sepolia)).toBe(true);
  });

  it("mock test contains createEncryptedInput + userDecryptEuint + ACL re-decrypt block", async () => {
    ws = makeWorkspace();
    await generateTests({ cwd: ws.root, contract: "Counter" });
    const mockPath = join(ws.testDir, "Counter.test.ts");
    const body = readFileSync(mockPath, "utf8");
    expect(body).toMatch(/createEncryptedInput/);
    expect(body).toMatch(/userDecryptEuint/);
    expect(body).toMatch(/ACL re-decrypt/i);
  });

  it("sepolia test contains network.name guard + HCU header + createInstance(SepoliaConfig)", async () => {
    ws = makeWorkspace();
    await generateTests({ cwd: ws.root, contract: "Counter" });
    const sepoliaPath = join(ws.testDir, "Counter.sepolia.test.ts");
    const body = readFileSync(sepoliaPath, "utf8");
    expect(body).toMatch(/if \(network\.name !== "sepolia"\) this\.skip\(\);/);
    expect(body).toMatch(/HCU revert risk/);
    expect(body).toMatch(/createInstance\(SepoliaConfig\)/);
  });

  it("generated files use ethers v6 syntax only (no BigNumber.from / fhevmjs / ethers@^5)", async () => {
    ws = makeWorkspace();
    await generateTests({ cwd: ws.root, contract: "Counter" });
    for (const file of ["Counter.test.ts", "Counter.sepolia.test.ts"]) {
      const body = readFileSync(join(ws.testDir, file), "utf8");
      expect(body).not.toMatch(/BigNumber\.from/);
      expect(body).not.toMatch(/fhevmjs/);
      expect(body).not.toMatch(/ethers@\^5/);
      expect(body).not.toMatch(/ethers\.utils\./);
      expect(body).not.toMatch(/ethers\.providers\./);
    }
  });

  it("aborts on second run without --force when file exists", async () => {
    ws = makeWorkspace();
    await generateTests({ cwd: ws.root, contract: "Counter" });
    await expect(generateTests({ cwd: ws.root, contract: "Counter" })).rejects.toThrow(/already exists/i);
  });

  it("overwrites with force=true", async () => {
    ws = makeWorkspace();
    await generateTests({ cwd: ws.root, contract: "Counter" });
    const result = await generateTests({ cwd: ws.root, contract: "Counter", force: true });
    expect(result.written).toHaveLength(2);
  });

  it("rejects non-PascalCase contract names (path traversal guard)", async () => {
    ws = makeWorkspace();
    await expect(generateTests({ cwd: ws.root, contract: "../evil" })).rejects.toThrow(/PascalCase|invalid/i);
    await expect(generateTests({ cwd: ws.root, contract: "counter" })).rejects.toThrow(/PascalCase|invalid/i);
  });

  it("substitutes contract name into both templates", async () => {
    ws = makeWorkspace();
    await generateTests({ cwd: ws.root, contract: "Counter" });
    const mock = readFileSync(join(ws.testDir, "Counter.test.ts"), "utf8");
    const sepolia = readFileSync(join(ws.testDir, "Counter.sepolia.test.ts"), "utf8");
    expect(mock).toMatch(/Counter/);
    expect(sepolia).toMatch(/Counter/);
    // Placeholders fully resolved
    expect(mock).not.toMatch(/<Name>/);
    expect(sepolia).not.toMatch(/<Name>/);
  });
});
