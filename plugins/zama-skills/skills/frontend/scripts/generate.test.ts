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

  it("writes the FHE pipeline + UI primitives + App on a vanilla custom variant", async () => {
    root = makeFrontendFixture(VALID_DEPS, VALID_DEV);
    const r = await generateFrontend({ workspaceRoot: root, contract: "Counter" });
    expect(r.ok).toBe(true);
    const rels = r.written.map((p) => p.replace(root + "/", ""));
    // Pipeline plumbing
    expect(rels).toContain("packages/frontend/src/lib/fhe.ts");
    expect(rels).toContain("packages/frontend/src/lib/utils.ts");
    expect(rels).toContain("packages/frontend/src/hooks/useDecrypted.ts");
    expect(rels).toContain("packages/frontend/src/components/EncryptedInput.tsx");
    // UI primitives
    for (const f of ["Button", "Card", "Input", "Badge", "TxStatus", "Header", "HandleReveal"]) {
      expect(rels).toContain(`packages/frontend/src/ui/${f}.tsx`);
    }
    // App composition
    expect(rels).toContain("packages/frontend/src/wagmi.ts");
    expect(rels).toContain("packages/frontend/src/App.tsx");
    for (const p of r.written) expect(existsSync(p)).toBe(true);
    // No contracts/contracts → variant fell back to "custom" → no panels.
    expect(r.variant).toBe("custom");
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

// ─── Variant detection + panel materialization ──────────────────────────────

function writeContractSource(root: string, name: string, body: string): void {
  const dir = join(root, "packages", "contracts", "contracts");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.sol`), body);
}

describe("generateFrontend — variant detection", () => {
  let root: string;
  afterEach(() => {
    if (root && existsSync(root)) rmSync(root, { recursive: true, force: true });
  });

  it("detects token variant from ERC7984 import → Mint+Balance+Transfer panels", async () => {
    root = makeFrontendFixture(VALID_DEPS, VALID_DEV);
    writeContractSource(
      root,
      "MyToken",
      'import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";\ncontract MyToken is ERC7984 {}',
    );
    writeFileSync(join(root, "packages/frontend/src/abis/MyToken.json"), JSON.stringify({ abi: [] }));
    const r = await generateFrontend({ workspaceRoot: root, contract: "MyToken" });
    expect(r.ok).toBe(true);
    expect(r.variant).toBe("token");
    const rels = r.written.map((p) => p.replace(root + "/", ""));
    expect(rels).toContain("packages/frontend/src/panels/MintPanel.tsx");
    expect(rels).toContain("packages/frontend/src/panels/BalancePanel.tsx");
    expect(rels).toContain("packages/frontend/src/panels/TransferPanel.tsx");
    expect(rels).not.toContain("packages/frontend/src/panels/DelegatePanel.tsx");
    expect(rels).not.toContain("packages/frontend/src/panels/WrapPanel.tsx");
  });

  it("detects voting variant from ERC7984Votes → 5 panels", async () => {
    root = makeFrontendFixture(VALID_DEPS, VALID_DEV);
    writeContractSource(
      root,
      "VotingToken",
      'import {ERC7984Votes} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984Votes.sol";\ncontract VotingToken is ERC7984Votes {}',
    );
    writeFileSync(join(root, "packages/frontend/src/abis/VotingToken.json"), JSON.stringify({ abi: [] }));
    const r = await generateFrontend({ workspaceRoot: root, contract: "VotingToken" });
    expect(r.ok).toBe(true);
    expect(r.variant).toBe("voting");
    const rels = r.written.map((p) => p.replace(root + "/", ""));
    for (const p of ["Mint", "Balance", "Transfer", "Delegate", "Votes"]) {
      expect(rels).toContain(`packages/frontend/src/panels/${p}Panel.tsx`);
    }
  });

  it("detects wrapper variant → Wrap+Unwrap+Balance", async () => {
    root = makeFrontendFixture(VALID_DEPS, VALID_DEV);
    writeContractSource(
      root,
      "USDCWrapper",
      'import {ERC7984ERC20Wrapper} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol";\ncontract USDCWrapper is ERC7984ERC20Wrapper {}',
    );
    writeFileSync(join(root, "packages/frontend/src/abis/USDCWrapper.json"), JSON.stringify({ abi: [] }));
    const r = await generateFrontend({ workspaceRoot: root, contract: "USDCWrapper" });
    expect(r.ok).toBe(true);
    expect(r.variant).toBe("wrapper");
    const rels = r.written.map((p) => p.replace(root + "/", ""));
    expect(rels).toContain("packages/frontend/src/panels/WrapPanel.tsx");
    expect(rels).toContain("packages/frontend/src/panels/UnwrapPanel.tsx");
    expect(rels).toContain("packages/frontend/src/panels/BalancePanel.tsx");
  });

  it("detects auction variant → BidPanel only", async () => {
    root = makeFrontendFixture(VALID_DEPS, VALID_DEV);
    writeContractSource(
      root,
      "Auction",
      "contract SealedBidAuction { function bid(bytes calldata enc, bytes calldata proof) external {} }",
    );
    writeFileSync(join(root, "packages/frontend/src/abis/Auction.json"), JSON.stringify({ abi: [] }));
    const r = await generateFrontend({ workspaceRoot: root, contract: "Auction" });
    expect(r.ok).toBe(true);
    expect(r.variant).toBe("auction");
    const rels = r.written.map((p) => p.replace(root + "/", ""));
    expect(rels).toContain("packages/frontend/src/panels/BidPanel.tsx");
    expect(rels).not.toContain("packages/frontend/src/panels/MintPanel.tsx");
  });

  it("explicit --variant override beats auto-detection", async () => {
    root = makeFrontendFixture(VALID_DEPS, VALID_DEV);
    writeContractSource(root, "Counter", "contract Counter {}");
    writeFileSync(join(root, "packages/frontend/src/abis/Counter.json"), JSON.stringify({ abi: [] }));
    const r = await generateFrontend({
      workspaceRoot: root,
      contract: "Counter",
      variant: "voting",
    });
    expect(r.ok).toBe(true);
    expect(r.variant).toBe("voting");
  });

  it("App.tsx wires the correct panels and contract address", async () => {
    root = makeFrontendFixture(VALID_DEPS, VALID_DEV);
    writeContractSource(
      root,
      "Tok",
      'import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";\ncontract Tok is ERC7984 {}',
    );
    writeFileSync(join(root, "packages/frontend/src/abis/Tok.json"), JSON.stringify({ abi: [] }));
    const r = await generateFrontend({
      workspaceRoot: root,
      contract: "Tok",
      contractAddress: "0xdeadbeef0000000000000000000000000000beef",
    });
    expect(r.ok).toBe(true);
    const app = readFileSync(join(root, "packages/frontend/src/App.tsx"), "utf8");
    expect(app).toMatch(/0xdeadbeef0000000000000000000000000000beef/);
    expect(app).toMatch(/import \{ MintPanel \} from "@\/panels\/MintPanel"/);
    expect(app).toMatch(/import \{ TransferPanel \} from "@\/panels\/TransferPanel"/);
    expect(app).toMatch(/import abiJson from "@\/abis\/Tok\.json"/);
    expect(app).not.toMatch(/import \{ DelegatePanel \}/);
  });

  it("panel templates use Tailwind classes + TxStatus", async () => {
    root = makeFrontendFixture(VALID_DEPS, VALID_DEV);
    writeContractSource(
      root,
      "T",
      'import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";\ncontract T is ERC7984 {}',
    );
    writeFileSync(join(root, "packages/frontend/src/abis/T.json"), JSON.stringify({ abi: [] }));
    await generateFrontend({ workspaceRoot: root, contract: "T" });
    const mint = readFileSync(join(root, "packages/frontend/src/panels/MintPanel.tsx"), "utf8");
    expect(mint).toMatch(/from "@\/ui\/Card"/);
    expect(mint).toMatch(/from "@\/ui\/TxStatus"/);
    // Tailwind class hint
    const header = readFileSync(join(root, "packages/frontend/src/ui/Header.tsx"), "utf8");
    expect(header).toMatch(/sticky top-0|backdrop-blur/);
  });
});
