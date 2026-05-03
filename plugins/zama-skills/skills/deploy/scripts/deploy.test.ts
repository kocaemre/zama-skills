/**
 * deploy.test.ts — vitest unit tests for the /zama-deploy skill helpers
 * (env-validate, sepolia-addresses, abi-export, preflight) and the
 * orchestrator (`runDeploy`).
 *
 * Plan 04-03 Task 2 + Task 3. Uses real fs + os.tmpdir() (no mocks).
 * execSync is stubbed via vi.fn injection through DI on `runDeploy`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { validateEnv, REQUIRED_ENV } from "./lib/env-validate.js";
import {
  parseAddressesFromHtml,
  getSepoliaAddresses,
  type Addresses,
} from "./lib/sepolia-addresses.js";
import { exportAbi } from "./lib/abi-export.js";
import { runPreflight } from "./lib/preflight.js";
import { runDeploy } from "./deploy.js";

function makeTmp(): string {
  return mkdtempSync(join(tmpdir(), `zama-deploy-test-${randomUUID()}-`));
}

// ─────────────────────────────────────────────────────────────────────────────
// env-validate
// ─────────────────────────────────────────────────────────────────────────────

describe("validateEnv", () => {
  it("exports REQUIRED_ENV with SEPOLIA_RPC_URL and ETHERSCAN_API_KEY", () => {
    expect(REQUIRED_ENV).toContain("SEPOLIA_RPC_URL");
    expect(REQUIRED_ENV).toContain("ETHERSCAN_API_KEY");
  });

  it("missing SEPOLIA_RPC_URL → ok=false, missing list contains it", () => {
    const r = validateEnv({
      ETHERSCAN_API_KEY: "x",
      PRIVATE_KEY: "0xabc",
    });
    expect(r.ok).toBe(false);
    expect(r.missing).toContain("SEPOLIA_RPC_URL");
  });

  it("has only PRIVATE_KEY (no MNEMONIC) → ok", () => {
    const r = validateEnv({
      SEPOLIA_RPC_URL: "https://x",
      ETHERSCAN_API_KEY: "x",
      PRIVATE_KEY: "0xabc",
    });
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("has only MNEMONIC (no PRIVATE_KEY) → ok", () => {
    const r = validateEnv({
      SEPOLIA_RPC_URL: "https://x",
      ETHERSCAN_API_KEY: "x",
      MNEMONIC: "test test test",
    });
    expect(r.ok).toBe(true);
  });

  it("missing both MNEMONIC and PRIVATE_KEY → missing list contains 'MNEMONIC|PRIVATE_KEY'", () => {
    const r = validateEnv({
      SEPOLIA_RPC_URL: "https://x",
      ETHERSCAN_API_KEY: "x",
    });
    expect(r.ok).toBe(false);
    expect(r.missing).toContain("MNEMONIC|PRIVATE_KEY");
  });

  it("empty string is treated as missing", () => {
    const r = validateEnv({
      SEPOLIA_RPC_URL: "",
      ETHERSCAN_API_KEY: "x",
      PRIVATE_KEY: "0xabc",
    });
    expect(r.ok).toBe(false);
    expect(r.missing).toContain("SEPOLIA_RPC_URL");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// sepolia-addresses (parser + cache)
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE_HTML = `
<html><body>
<h2>ACL</h2>
<p>Address: <code>0x687820221192C5B662b25367F70076A37bc79b6c</code></p>

<h2>KMSVerifier</h2>
<p>Sepolia: 0x9D6891A6240D6130c54ae243d8005063D05fE14b</p>

<h2>InputVerifier</h2>
<code>0xbc91f3daD1A5F19F8390c400196e58073B6a0BC4</code>

<h2>FHEVMExecutor</h2>
<code>0x848B0066793BcC60346Da1F49049357399B8D595</code>

<h2>DecryptionOracle</h2>
<code>0xa02Cda4Ca3a71D7C46997716F4283aa851C28812</code>

<h2>ConfidentialTokenRegistry</h2>
<code>0x2F1F2C3D4E5F6789AbCdEf0123456789AbCdEf01</code>
</body></html>
`;

describe("parseAddressesFromHtml", () => {
  it("extracts the 6 expected fields from sample HTML", () => {
    const a = parseAddressesFromHtml(SAMPLE_HTML);
    expect(a.ACL?.toLowerCase()).toBe(
      "0x687820221192C5B662b25367F70076A37bc79b6c".toLowerCase(),
    );
    expect(a.KMSVerifier?.toLowerCase()).toBe(
      "0x9D6891A6240D6130c54ae243d8005063D05fE14b".toLowerCase(),
    );
    expect(a.InputVerifier?.toLowerCase()).toBe(
      "0xbc91f3daD1A5F19F8390c400196e58073B6a0BC4".toLowerCase(),
    );
    expect(a.FHEVMExecutor?.toLowerCase()).toBe(
      "0x848B0066793BcC60346Da1F49049357399B8D595".toLowerCase(),
    );
    expect(a.DecryptionOracle?.toLowerCase()).toBe(
      "0xa02Cda4Ca3a71D7C46997716F4283aa851C28812".toLowerCase(),
    );
    expect(a.ConfidentialTokenRegistry?.toLowerCase()).toBe(
      "0x2F1F2C3D4E5F6789AbCdEf0123456789AbCdEf01".toLowerCase(),
    );
  });

  it("returns empty object on HTML with no addresses", () => {
    const a = parseAddressesFromHtml("<html><body>nothing</body></html>");
    expect(a.ACL).toBeUndefined();
    expect(a.ConfidentialTokenRegistry).toBeUndefined();
  });
});

describe("getSepoliaAddresses (cache)", () => {
  let dir: string;
  beforeEach(() => {
    dir = makeTmp();
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("cold fetch → calls fetcher, writes cache file", async () => {
    const fetcher = vi.fn(async () => SAMPLE_HTML);
    const res = await getSepoliaAddresses({ cacheDir: dir, fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(res.ACL?.toLowerCase()).toBe(
      "0x687820221192C5B662b25367F70076A37bc79b6c".toLowerCase(),
    );
    const cachePath = join(dir, "zama-addresses.json");
    expect(existsSync(cachePath)).toBe(true);
    const cached = JSON.parse(readFileSync(cachePath, "utf8"));
    expect(cached.fetchedAt).toBeTruthy();
    expect(cached.ttlHours).toBe(24);
    expect(cached.addresses.ACL).toBeTruthy();
  });

  it("warm cache (<24h) → does NOT call fetcher", async () => {
    const fetcher = vi.fn(async () => SAMPLE_HTML);
    await getSepoliaAddresses({ cacheDir: dir, fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockClear();
    const res2 = await getSepoliaAddresses({ cacheDir: dir, fetcher });
    expect(fetcher).not.toHaveBeenCalled();
    expect(res2.ACL?.toLowerCase()).toBe(
      "0x687820221192C5B662b25367F70076A37bc79b6c".toLowerCase(),
    );
  });

  it("stale cache (>24h) → refetches", async () => {
    const stale: { fetchedAt: string; ttlHours: number; addresses: Addresses } =
      {
        fetchedAt: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
        ttlHours: 24,
        addresses: { ACL: "0x000000000000000000000000000000000000dead" },
      };
    writeFileSync(join(dir, "zama-addresses.json"), JSON.stringify(stale));
    const fetcher = vi.fn(async () => SAMPLE_HTML);
    const res = await getSepoliaAddresses({ cacheDir: dir, fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(res.ACL?.toLowerCase()).toBe(
      "0x687820221192C5B662b25367F70076A37bc79b6c".toLowerCase(),
    );
  });

  it("WebFetch fails on cold → throws actionable message", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("network down");
    });
    await expect(
      getSepoliaAddresses({ cacheDir: dir, fetcher }),
    ).rejects.toThrow(/Zama Sepolia address registry/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// abi-export
// ─────────────────────────────────────────────────────────────────────────────

describe("exportAbi", () => {
  let dir: string;
  beforeEach(() => {
    dir = makeTmp();
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reads artifact, writes packages/frontend/src/abis/<Name>.json", () => {
    const artifactDir = join(dir, "artifacts/contracts/Counter.sol");
    mkdirSync(artifactDir, { recursive: true });
    writeFileSync(
      join(artifactDir, "Counter.json"),
      JSON.stringify({
        abi: [{ type: "function", name: "increment" }],
        bytecode: "0xdeadbeef",
        contractName: "Counter",
      }),
    );

    const out = exportAbi("Counter", "0xabc0000000000000000000000000000000000001", {
      cwd: dir,
    });
    expect(out).toBe(join(dir, "packages/frontend/src/abis/Counter.json"));
    expect(existsSync(out)).toBe(true);
    const parsed = JSON.parse(readFileSync(out, "utf8"));
    expect(parsed.abi[0].name).toBe("increment");
    expect(parsed.bytecode).toBe("0xdeadbeef");
    expect(parsed.address).toBe("0xabc0000000000000000000000000000000000001");
    expect(parsed.network).toBe("sepolia");
  });

  it("missing artifact → throws 'run pnpm hardhat compile first'", () => {
    expect(() =>
      exportAbi("Missing", "0xabc0000000000000000000000000000000000001", {
        cwd: dir,
      }),
    ).toThrow(/pnpm hardhat compile/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// preflight
// ─────────────────────────────────────────────────────────────────────────────

describe("preflight (deploy)", () => {
  let dir: string;
  beforeEach(() => {
    dir = makeTmp();
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function writeRoot(extraPkg: Record<string, string> = {}) {
    mkdirSync(join(dir, "packages/contracts"), { recursive: true });
    writeFileSync(
      join(dir, "packages/contracts/package.json"),
      JSON.stringify({
        name: "contracts",
        devDependencies: { hardhat: "^2.28.4", ethers: "^6.16.0", ...extraPkg },
      }),
    );
    writeFileSync(
      join(dir, "packages/contracts/hardhat.config.ts"),
      `export default { networks: { sepolia: { chainId: 11155111, url: "https://x" } } };`,
    );
  }

  it("ok when chainId 11155111 + hardhat ^2 + ethers ^6", () => {
    writeRoot();
    const r = runPreflight({ cwd: dir });
    expect(r.ok).toBe(true);
  });

  it("chainId !== 11155111 → ABORT: not Sepolia", () => {
    mkdirSync(join(dir, "packages/contracts"), { recursive: true });
    writeFileSync(
      join(dir, "packages/contracts/package.json"),
      JSON.stringify({
        name: "contracts",
        devDependencies: { hardhat: "^2.28.4", ethers: "^6.16.0" },
      }),
    );
    writeFileSync(
      join(dir, "packages/contracts/hardhat.config.ts"),
      `export default { networks: { sepolia: { chainId: 1, url: "https://x" } } };`,
    );
    const r = runPreflight({ cwd: dir });
    expect(r.ok).toBe(false);
    expect(r.failures.join("\n")).toMatch(/ABORT: not Sepolia/);
  });

  it("hardhat ^3 → refuses with deprecation guard message", () => {
    writeRoot({ hardhat: "^3.4.3" });
    const r = runPreflight({ cwd: dir });
    expect(r.ok).toBe(false);
    expect(r.failures.join("\n")).toMatch(/hardhat/i);
  });

  it("ethers ^5 → refuses", () => {
    writeRoot({ ethers: "^5.7.2" });
    const r = runPreflight({ cwd: dir });
    expect(r.ok).toBe(false);
    expect(r.failures.join("\n")).toMatch(/ethers/i);
  });

  it("missing packages/contracts → fails with 'workspace not found'", () => {
    const r = runPreflight({ cwd: dir });
    expect(r.ok).toBe(false);
    expect(r.failures.join("\n")).toMatch(/workspace/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// orchestrator (deploy.ts)
// ─────────────────────────────────────────────────────────────────────────────

describe("runDeploy orchestrator", () => {
  let dir: string;
  beforeEach(() => {
    dir = makeTmp();
    // Set up a minimal valid workspace + .env for the happy path
    mkdirSync(join(dir, "packages/contracts/contracts"), { recursive: true });
    writeFileSync(
      join(dir, "packages/contracts/package.json"),
      JSON.stringify({
        name: "contracts",
        devDependencies: { hardhat: "^2.28.4", ethers: "^6.16.0" },
      }),
    );
    writeFileSync(
      join(dir, "packages/contracts/hardhat.config.ts"),
      `export default { networks: { sepolia: { chainId: 11155111, url: "https://x" } } };`,
    );
    writeFileSync(
      join(dir, "packages/contracts/contracts/Counter.sol"),
      "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.27;\ncontract Counter { uint256 public x; }",
    );
    // artifact for abi-export
    const artifactDir = join(
      dir,
      "packages/contracts/artifacts/contracts/Counter.sol",
    );
    mkdirSync(artifactDir, { recursive: true });
    writeFileSync(
      join(artifactDir, "Counter.json"),
      JSON.stringify({ abi: [], bytecode: "0x00", contractName: "Counter" }),
    );
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("happy path: runs steps 1→7 in order, prints summary, no Step 5 for non-ERC7984", async () => {
    const calls: string[] = [];
    const exec = vi.fn((cmd: string) => {
      calls.push(cmd);
      if (cmd.includes("hardhat run") && cmd.includes("scripts/deploy/")) {
        return "Deployed at: 0xabc0000000000000000000000000000000000001\n";
      }
      return "";
    });
    const fetcher = vi.fn(async () => SAMPLE_HTML);
    const r = await runDeploy({
      contract: "Counter",
      args: [],
      env: {
        SEPOLIA_RPC_URL: "https://x",
        ETHERSCAN_API_KEY: "k",
        PRIVATE_KEY: "0xabc",
      },
      cwd: dir,
      exec,
      fetcher,
    });
    expect(r.ok).toBe(true);
    expect(r.address?.toLowerCase()).toBe(
      "0xabc0000000000000000000000000000000000001",
    );
    // Step ordering
    const compileIdx = calls.findIndex((c) => c.includes("hardhat compile"));
    const deployIdx = calls.findIndex(
      (c) => c.includes("hardhat run") && c.includes("scripts/deploy/"),
    );
    const verifyIdx = calls.findIndex((c) => c.includes("hardhat verify"));
    expect(compileIdx).toBeGreaterThan(-1);
    expect(deployIdx).toBeGreaterThan(compileIdx);
    expect(verifyIdx).toBeGreaterThan(deployIdx);
    // Step 5 should NOT have run for non-ERC7984
    expect(calls.find((c) => c.includes("register-token.ts"))).toBeUndefined();
    // ABI export ran
    expect(
      existsSync(join(dir, "packages/frontend/src/abis/Counter.json")),
    ).toBe(true);
    // Closing summary fields
    expect(r.summary).toMatch(/sepolia\.etherscan\.io\/address/);
    expect(r.summary).toMatch(/VITE_COUNTER_ADDRESS/);
    expect(r.summary).toMatch(/\/zama-frontend/);
  });

  it("missing env → exits at Step 1 with named missing list, never compiles", async () => {
    const exec = vi.fn(() => "");
    const r = await runDeploy({
      contract: "Counter",
      args: [],
      env: {}, // empty
      cwd: dir,
      exec,
      fetcher: async () => SAMPLE_HTML,
    });
    expect(r.ok).toBe(false);
    expect(r.missingEnv).toBeDefined();
    expect(r.missingEnv).toContain("SEPOLIA_RPC_URL");
    expect(r.missingEnv).toContain("ETHERSCAN_API_KEY");
    expect(r.missingEnv).toContain("MNEMONIC|PRIVATE_KEY");
    // exec must NOT have been called for compile
    expect(exec).not.toHaveBeenCalled();
  });

  it("ERC7984 contract → Step 5 runs registration", async () => {
    writeFileSync(
      join(dir, "packages/contracts/contracts/Token.sol"),
      "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.27;\nimport { ERC7984 } from 'oz';\ncontract Token is ERC7984 {}",
    );
    const artifactDir = join(
      dir,
      "packages/contracts/artifacts/contracts/Token.sol",
    );
    mkdirSync(artifactDir, { recursive: true });
    writeFileSync(
      join(artifactDir, "Token.json"),
      JSON.stringify({ abi: [], bytecode: "0x00", contractName: "Token" }),
    );

    const calls: string[] = [];
    const exec = vi.fn((cmd: string) => {
      calls.push(cmd);
      if (cmd.includes("hardhat run") && cmd.includes("scripts/deploy/")) {
        return "Deployed at: 0xdef0000000000000000000000000000000000001\n";
      }
      if (cmd.includes("register-token")) {
        return "Registered tx: 0x9999000000000000000000000000000000000000000000000000000000000001\n";
      }
      return "";
    });
    const r = await runDeploy({
      contract: "Token",
      args: [],
      env: {
        SEPOLIA_RPC_URL: "https://x",
        ETHERSCAN_API_KEY: "k",
        PRIVATE_KEY: "0xabc",
      },
      cwd: dir,
      exec,
      fetcher: async () => SAMPLE_HTML,
    });
    expect(r.ok).toBe(true);
    expect(calls.find((c) => c.includes("register-token"))).toBeDefined();
    expect(r.registryTxHash).toBeDefined();
  });

  it("chainId !== 11155111 → exits at Step 0 with ABORT: not Sepolia", async () => {
    writeFileSync(
      join(dir, "packages/contracts/hardhat.config.ts"),
      `export default { networks: { sepolia: { chainId: 1, url: "https://x" } } };`,
    );
    const exec = vi.fn(() => "");
    const r = await runDeploy({
      contract: "Counter",
      args: [],
      env: {
        SEPOLIA_RPC_URL: "https://x",
        ETHERSCAN_API_KEY: "k",
        PRIVATE_KEY: "0xabc",
      },
      cwd: dir,
      exec,
      fetcher: async () => SAMPLE_HTML,
    });
    expect(r.ok).toBe(false);
    expect(r.preflightFailures?.join("\n")).toMatch(/ABORT: not Sepolia/);
    expect(exec).not.toHaveBeenCalled();
  });
});
