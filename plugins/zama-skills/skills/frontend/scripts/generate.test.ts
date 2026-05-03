/**
 * generate.test.ts — vitest coverage for `/zama-frontend` generator.
 *
 * Behaviors verified (from Plan 04-04 Task 2):
 *   - generate({contract:"Counter"}) writes the 3 expected files
 *   - generate({contract:"Counter", withWagmi:true}) writes fhe.ts from the wagmi shim
 *   - useDecrypted output literally contains the 4 status strings
 *   - EncryptedInput output uses createEncryptedInput and emits {handle, inputProof}
 *   - preflight detects @typechain/ethers-v5 and refuses with migration cmd
 *   - preflight detects ethers ^5 and refuses
 *   - post-grep: 0 'fhevmjs' matches in any generated file
 *   - generate twice without --force → second aborts (file exists)
 *
 * Each test uses a temp fixture directory containing a synthetic
 * `packages/frontend/package.json`. No network, no real npm install.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { generateFrontend } from "./generate.js";
import { runFrontendPreflight } from "./lib/preflight.js";

function makeFrontendFixture(deps: Record<string, string>, devDeps: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "zama-fe-"));
  const fePkg = join(root, "packages", "frontend");
  mkdirSync(fePkg, { recursive: true });
  writeFileSync(
    join(fePkg, "package.json"),
    JSON.stringify({ name: "frontend", dependencies: deps, devDependencies: devDeps }, null, 2),
  );
  // ABI fixture so generator can wire the import path.
  mkdirSync(join(fePkg, "src", "abis"), { recursive: true });
  writeFileSync(join(fePkg, "src", "abis", "Counter.json"), JSON.stringify({ abi: [] }));
  return root;
}

const VALID_DEPS = {
  ethers: "^6.16.0",
  "@zama-fhe/relayer-sdk": "^0.4.2",
  react: "^18.3.0",
};
const VALID_DEV = {
  "@typechain/ethers-v6": "^0.5.1",
  typescript: "^5.9.3",
};

describe("runFrontendPreflight", () => {
  let root: string;
  afterEach(() => {
    if (root && existsSync(root)) rmSync(root, { recursive: true, force: true });
  });

  it("passes with ethers v6 + typechain v6", () => {
    root = makeFrontendFixture(VALID_DEPS, VALID_DEV);
    const r = runFrontendPreflight({ workspaceRoot: root });
    expect(r.ok).toBe(true);
    expect(r.failures).toEqual([]);
  });

  it("refuses ethers ^5", () => {
    root = makeFrontendFixture({ ...VALID_DEPS, ethers: "^5.7.0" }, VALID_DEV);
    const r = runFrontendPreflight({ workspaceRoot: root });
    expect(r.ok).toBe(false);
    expect(r.failures.join("\n")).toMatch(/ethers/);
    expect(r.failures.join("\n")).toMatch(/v6/);
  });

  it("refuses @typechain/ethers-v5 and emits migration cmd", () => {
    root = makeFrontendFixture(VALID_DEPS, { ...VALID_DEV, "@typechain/ethers-v5": "^11.0.0" });
    const r = runFrontendPreflight({ workspaceRoot: root });
    expect(r.ok).toBe(false);
    const all = r.failures.join("\n");
    expect(all).toMatch(/@typechain\/ethers-v5/);
    expect(all).toMatch(/pnpm remove @typechain\/ethers-v5/);
    expect(all).toMatch(/pnpm add -D @typechain\/ethers-v6/);
  });

  it("refuses if packages/frontend missing", () => {
    root = mkdtempSync(join(tmpdir(), "zama-fe-empty-"));
    const r = runFrontendPreflight({ workspaceRoot: root });
    expect(r.ok).toBe(false);
    expect(r.failures.join("\n")).toMatch(/packages\/frontend/);
  });
});

describe("generateFrontend", () => {
  let root: string;
  afterEach(() => {
    if (root && existsSync(root)) rmSync(root, { recursive: true, force: true });
  });

  it("writes the 3 expected files (vanilla, no wagmi)", async () => {
    root = makeFrontendFixture(VALID_DEPS, VALID_DEV);
    const r = await generateFrontend({ workspaceRoot: root, contract: "Counter" });
    expect(r.ok).toBe(true);
    expect(r.written.map((p) => p.replace(root + "/", ""))).toEqual([
      "packages/frontend/src/lib/fhe.ts",
      "packages/frontend/src/hooks/useDecrypted.ts",
      "packages/frontend/src/components/EncryptedInput.tsx",
    ]);
    for (const p of r.written) expect(existsSync(p)).toBe(true);
  });

  it("emits the wagmi shim into fhe.ts when withWagmi=true", async () => {
    root = makeFrontendFixture(VALID_DEPS, VALID_DEV);
    const r = await generateFrontend({ workspaceRoot: root, contract: "Counter", withWagmi: true });
    expect(r.ok).toBe(true);
    const fhe = readFileSync(join(root, "packages/frontend/src/lib/fhe.ts"), "utf8");
    expect(fhe).toMatch(/useWalletClient|wagmi/);
    expect(fhe).not.toMatch(/window\.ethereum/);
  });

  it("vanilla fhe.ts uses window.ethereum (no wagmi import)", async () => {
    root = makeFrontendFixture(VALID_DEPS, VALID_DEV);
    await generateFrontend({ workspaceRoot: root, contract: "Counter" });
    const fhe = readFileSync(join(root, "packages/frontend/src/lib/fhe.ts"), "utf8");
    expect(fhe).toMatch(/window\.ethereum/);
    expect(fhe).not.toMatch(/from ['"]wagmi['"]/);
  });

  it("useDecrypted contains the 4 status strings literally", async () => {
    root = makeFrontendFixture(VALID_DEPS, VALID_DEV);
    await generateFrontend({ workspaceRoot: root, contract: "Counter" });
    const hook = readFileSync(join(root, "packages/frontend/src/hooks/useDecrypted.ts"), "utf8");
    expect(hook).toMatch(/['"]idle['"]/);
    expect(hook).toMatch(/['"]requesting['"]/);
    expect(hook).toMatch(/['"]decrypted['"]/);
    expect(hook).toMatch(/['"]error['"]/);
  });

  it("EncryptedInput uses createEncryptedInput and emits {handle, inputProof}", async () => {
    root = makeFrontendFixture(VALID_DEPS, VALID_DEV);
    await generateFrontend({ workspaceRoot: root, contract: "Counter" });
    const cmp = readFileSync(join(root, "packages/frontend/src/components/EncryptedInput.tsx"), "utf8");
    expect(cmp).toMatch(/createEncryptedInput/);
    expect(cmp).toMatch(/handle/);
    expect(cmp).toMatch(/inputProof/);
    expect(cmp).toMatch(/onEncrypted/);
  });

  it("post-grep: zero fhevmjs references in any generated file", async () => {
    root = makeFrontendFixture(VALID_DEPS, VALID_DEV);
    const r = await generateFrontend({ workspaceRoot: root, contract: "Counter", withWagmi: true });
    for (const p of r.written) {
      const body = readFileSync(p, "utf8");
      expect(body).not.toMatch(/fhevmjs/);
    }
  });

  it("imports @zama-fhe/relayer-sdk in fhe.ts", async () => {
    root = makeFrontendFixture(VALID_DEPS, VALID_DEV);
    await generateFrontend({ workspaceRoot: root, contract: "Counter" });
    const fhe = readFileSync(join(root, "packages/frontend/src/lib/fhe.ts"), "utf8");
    expect(fhe).toMatch(/@zama-fhe\/relayer-sdk/);
  });

  it("substitutes contract name into ABI import path", async () => {
    root = makeFrontendFixture(VALID_DEPS, VALID_DEV);
    writeFileSync(join(root, "packages/frontend/src/abis/MyToken.json"), JSON.stringify({ abi: [] }));
    await generateFrontend({ workspaceRoot: root, contract: "MyToken" });
    const cmp = readFileSync(join(root, "packages/frontend/src/components/EncryptedInput.tsx"), "utf8");
    // Either the ABI path or the contract name appears in the component output.
    expect(cmp).toMatch(/MyToken|@\/abis\/MyToken/);
  });

  it("aborts on overwrite without --force", async () => {
    root = makeFrontendFixture(VALID_DEPS, VALID_DEV);
    await generateFrontend({ workspaceRoot: root, contract: "Counter" });
    const r2 = await generateFrontend({ workspaceRoot: root, contract: "Counter" });
    expect(r2.ok).toBe(false);
    expect(r2.error).toMatch(/exist|--force/i);
  });

  it("succeeds on overwrite with force=true", async () => {
    root = makeFrontendFixture(VALID_DEPS, VALID_DEV);
    await generateFrontend({ workspaceRoot: root, contract: "Counter" });
    const r2 = await generateFrontend({ workspaceRoot: root, contract: "Counter", force: true });
    expect(r2.ok).toBe(true);
  });

  it("propagates preflight failures (ethers v5)", async () => {
    root = makeFrontendFixture({ ...VALID_DEPS, ethers: "^5.7.0" }, VALID_DEV);
    const r = await generateFrontend({ workspaceRoot: root, contract: "Counter" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/ethers/);
  });
});
