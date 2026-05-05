/**
 * generate.ts — runtime orchestrator for `/zama-frontend`.
 *
 * Materializes a complete UI scaffold into a /zama-init'd workspace, on top of
 * the encryption pipeline plumbing. Produces, under packages/frontend/src/:
 *
 *   FHE pipeline (always):
 *     - lib/fhe.ts            (or wagmi shim with --with-wagmi)
 *     - lib/utils.ts          (cn() + shortAddr/shortHandle)
 *     - hooks/useDecrypted.ts (relayer decrypt state machine)
 *     - components/EncryptedInput.tsx
 *
 *   UI primitives (always):
 *     - ui/Button.tsx, Card.tsx, Input.tsx, Badge.tsx, TxStatus.tsx,
 *       Header.tsx, HandleReveal.tsx
 *
 *   App composition (always):
 *     - wagmi.ts, App.tsx (variant-aware panel composition)
 *
 *   Panels (variant-driven):
 *     - token   → Mint + Balance + Transfer
 *     - voting  → Mint + Balance + Transfer + Delegate + Votes
 *     - wrapper → Wrap + Unwrap + Balance
 *     - auction → Bid
 *     - custom  → none (App.tsx renders a "wire your panels here" placeholder)
 *
 * Performs preflight (typechain v6 / ethers v6) before write, post-grep for
 * deprecated `fhevmjs` token after write.
 *
 * CLI:
 *   tsx generate.ts --contract <Name>
 *                   [--with-wagmi] [--force] [--workspace <dir>]
 *                   [--variant <token|voting|wrapper|auction|custom>]
 *                   [--contract-address 0x…]
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, exit, stderr, stdout, cwd } from "node:process";

import { runFrontendPreflight } from "./lib/preflight.js";

export type Variant = "token" | "voting" | "wrapper" | "auction" | "custom";

export interface GenerateOptions {
  workspaceRoot: string;
  contract: string;
  withWagmi?: boolean;
  force?: boolean;
  /** Override variant detection. */
  variant?: Variant;
  /** Optional deployed contract address — placeholder used if absent. */
  contractAddress?: string;
}

export interface GenerateResult {
  ok: boolean;
  written: string[];
  variant?: Variant;
  error?: string;
}

interface OutputSpec {
  template: string;
  dest: string;
}

function locateTemplatesRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidate = resolve(here, "..", "assets", "templates");
  if (!existsSync(candidate)) {
    throw new Error(`[generate] templates dir not found at ${candidate}`);
  }
  return candidate;
}

/**
 * Inspect packages/contracts/contracts/ for known import patterns to pick a
 * variant. Falls back to "custom" when nothing matches.
 *
 * Order matters: Wrapper imports also pull ERC7984, so check wrapper first.
 * Voting imports also pull ERC7984, so check voting before plain token.
 */
export function detectVariant(workspaceRoot: string, contract: string): Variant {
  const contractsDir = join(workspaceRoot, "packages", "contracts", "contracts");
  if (!existsSync(contractsDir)) return "custom";

  const candidates: string[] = [];
  const target = join(contractsDir, `${contract}.sol`);
  if (existsSync(target)) candidates.push(target);
  // Fallback: scan all .sol files (covers cases where the user renamed the
  // contract and --contract argument doesn't match the filename).
  try {
    for (const f of readdirSync(contractsDir)) {
      if (f.endsWith(".sol")) candidates.push(join(contractsDir, f));
    }
  } catch {
    /* ignore */
  }

  let saw: { wrapper: boolean; voting: boolean; token: boolean; auction: boolean } = {
    wrapper: false,
    voting: false,
    token: false,
    auction: false,
  };

  for (const path of candidates) {
    let body: string;
    try {
      body = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    if (/ERC7984ERC20Wrapper/.test(body)) saw.wrapper = true;
    if (/ERC7984Votes\b|VotesConfidential\b/.test(body)) saw.voting = true;
    if (/\bERC7984\b/.test(body)) saw.token = true;
    if (/SealedBidAuction|sealed[-_ ]?bid|\bauction\b/i.test(body) || /\bbid\(/.test(body)) {
      saw.auction = true;
    }
  }

  if (saw.wrapper) return "wrapper";
  if (saw.voting) return "voting";
  if (saw.auction && !saw.token) return "auction";
  if (saw.token) return "token";
  return "custom";
}

interface PanelEntry {
  template: string;
  destFile: string;
  importName: string;
  /** JSX rendered inside App.tsx <ConnectedView> grid. */
  jsx: string;
}

const PANELS: Record<string, PanelEntry> = {
  Mint: {
    template: "panels/MintPanel.tsx.tpl",
    destFile: "panels/MintPanel.tsx",
    importName: "MintPanel",
    jsx: `<MintPanel contractAddress={CONTRACT_ADDRESS} abi={ABI} signer={address} />`,
  },
  Balance: {
    template: "panels/BalancePanel.tsx.tpl",
    destFile: "panels/BalancePanel.tsx",
    importName: "BalancePanel",
    jsx: `<BalancePanel contractAddress={CONTRACT_ADDRESS} abi={ABI} signer={address} />`,
  },
  Transfer: {
    template: "panels/TransferPanel.tsx.tpl",
    destFile: "panels/TransferPanel.tsx",
    importName: "TransferPanel",
    jsx: `<TransferPanel contractAddress={CONTRACT_ADDRESS} abi={ABI} signer={address} />`,
  },
  Delegate: {
    template: "panels/DelegatePanel.tsx.tpl",
    destFile: "panels/DelegatePanel.tsx",
    importName: "DelegatePanel",
    jsx: `<DelegatePanel contractAddress={CONTRACT_ADDRESS} abi={ABI} signer={address} />`,
  },
  Votes: {
    template: "panels/VotesPanel.tsx.tpl",
    destFile: "panels/VotesPanel.tsx",
    importName: "VotesPanel",
    jsx: `<VotesPanel contractAddress={CONTRACT_ADDRESS} abi={ABI} signer={address} />`,
  },
  Wrap: {
    template: "panels/WrapPanel.tsx.tpl",
    destFile: "panels/WrapPanel.tsx",
    importName: "WrapPanel",
    jsx: `<WrapPanel contractAddress={CONTRACT_ADDRESS} abi={ABI} />`,
  },
  Unwrap: {
    template: "panels/UnwrapPanel.tsx.tpl",
    destFile: "panels/UnwrapPanel.tsx",
    importName: "UnwrapPanel",
    jsx: `<UnwrapPanel contractAddress={CONTRACT_ADDRESS} abi={ABI} signer={address} />`,
  },
  Bid: {
    template: "panels/BidPanel.tsx.tpl",
    destFile: "panels/BidPanel.tsx",
    importName: "BidPanel",
    jsx: `<BidPanel contractAddress={CONTRACT_ADDRESS} abi={ABI} signer={address} />`,
  },
};

const PANELS_BY_VARIANT: Record<Variant, (keyof typeof PANELS)[]> = {
  token: ["Mint", "Balance", "Transfer"],
  voting: ["Mint", "Balance", "Transfer", "Delegate", "Votes"],
  wrapper: ["Wrap", "Unwrap", "Balance"],
  auction: ["Bid"],
  custom: [],
};

function fixedSpecs(opts: GenerateOptions): OutputSpec[] {
  const fheTpl = opts.withWagmi ? "fhe-wagmi.ts.tpl" : "fhe.ts.tpl";
  return [
    { template: fheTpl, dest: "packages/frontend/src/lib/fhe.ts" },
    { template: "lib/utils.ts.tpl", dest: "packages/frontend/src/lib/utils.ts" },
    { template: "useDecrypted.ts.tpl", dest: "packages/frontend/src/hooks/useDecrypted.ts" },
    { template: "EncryptedInput.tsx.tpl", dest: "packages/frontend/src/components/EncryptedInput.tsx" },
    { template: "ui/Button.tsx.tpl", dest: "packages/frontend/src/ui/Button.tsx" },
    { template: "ui/Card.tsx.tpl", dest: "packages/frontend/src/ui/Card.tsx" },
    { template: "ui/Input.tsx.tpl", dest: "packages/frontend/src/ui/Input.tsx" },
    { template: "ui/Badge.tsx.tpl", dest: "packages/frontend/src/ui/Badge.tsx" },
    { template: "ui/TxStatus.tsx.tpl", dest: "packages/frontend/src/ui/TxStatus.tsx" },
    { template: "ui/Header.tsx.tpl", dest: "packages/frontend/src/ui/Header.tsx" },
    { template: "ui/HandleReveal.tsx.tpl", dest: "packages/frontend/src/ui/HandleReveal.tsx" },
    { template: "app/wagmi.ts.tpl", dest: "packages/frontend/src/wagmi.ts" },
  ];
}

function panelSpecs(variant: Variant): { spec: OutputSpec; entry: PanelEntry }[] {
  const keys = PANELS_BY_VARIANT[variant];
  return keys.map((k) => {
    const entry = PANELS[k]!;
    return {
      spec: {
        template: entry.template,
        dest: `packages/frontend/src/${entry.destFile}`,
      },
      entry,
    };
  });
}

function buildAppTsx(
  templateBody: string,
  opts: { variant: Variant; contract: string; useCaseTitle: string; contractAddress: string; panels: PanelEntry[] },
): string {
  const imports = opts.panels.length
    ? opts.panels
        .map((p) => `import { ${p.importName} } from "@/panels/${p.importName}";`)
        .join("\n")
    : "// no variant-specific panels — see /zama-frontend docs";

  const render = opts.panels.length
    ? opts.panels.map((p) => `      ${p.jsx}`).join("\n")
    : `      <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">No panels were generated for variant "custom". Edit src/App.tsx or re-run /zama-frontend with --variant.</p></CardContent></Card>`;

  return templateBody
    .replace(/\{\{VARIANT\}\}/g, opts.variant)
    .replace(/\{\{CONTRACT\}\}/g, opts.contract)
    .replace(/\{\{CONTRACT_ADDRESS\}\}/g, opts.contractAddress)
    .replace(/\{\{USE_CASE_TITLE\}\}/g, opts.useCaseTitle)
    .replace(/\{\{PANEL_IMPORTS\}\}/g, imports)
    .replace(/\{\{PANEL_RENDER\}\}/g, render);
}

function applySubstitutions(body: string, contract: string): string {
  return body.replace(/__CONTRACT__/g, contract);
}

function titleCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function generateFrontend(opts: GenerateOptions): Promise<GenerateResult> {
  const written: string[] = [];

  const pre = runFrontendPreflight({ workspaceRoot: opts.workspaceRoot });
  if (!pre.ok) {
    return {
      ok: false,
      written: [],
      error: `preflight failed:\n  - ${pre.failures.join("\n  - ")}`,
    };
  }

  const variant = opts.variant ?? detectVariant(opts.workspaceRoot, opts.contract);
  const templatesRoot = locateTemplatesRoot();

  const fixed = fixedSpecs(opts);
  const panels = panelSpecs(variant);
  const appSpec: OutputSpec = {
    template: "app/App.tsx.tpl",
    dest: "packages/frontend/src/App.tsx",
  };
  const allSpecs: OutputSpec[] = [...fixed, ...panels.map((p) => p.spec), appSpec];

  if (!opts.force) {
    const existing = allSpecs.filter((s) => existsSync(join(opts.workspaceRoot, s.dest)));
    if (existing.length > 0) {
      return {
        ok: false,
        written: [],
        error: `refusing to overwrite existing file(s): ${existing.map((e) => e.dest).join(", ")}. Pass --force to regenerate.`,
      };
    }
  }

  const contractAddress = opts.contractAddress ?? "0x0000000000000000000000000000000000000000";

  // 3a. Materialize fixed + panel files (literal copy with __CONTRACT__ swap).
  for (const spec of [...fixed, ...panels.map((p) => p.spec)]) {
    const tplPath = join(templatesRoot, spec.template);
    const destAbs = join(opts.workspaceRoot, spec.dest);
    const body = applySubstitutions(readFileSync(tplPath, "utf8"), opts.contract);
    mkdirSync(dirname(destAbs), { recursive: true });
    writeFileSync(destAbs, body, "utf8");
    written.push(destAbs);
  }

  // 3b. Materialize App.tsx with full substitution.
  const appTplBody = readFileSync(join(templatesRoot, appSpec.template), "utf8");
  const appOut = buildAppTsx(appTplBody, {
    variant,
    contract: opts.contract,
    useCaseTitle: titleCase(opts.contract),
    contractAddress,
    panels: panels.map((p) => p.entry),
  });
  const appAbs = join(opts.workspaceRoot, appSpec.dest);
  mkdirSync(dirname(appAbs), { recursive: true });
  writeFileSync(appAbs, appOut, "utf8");
  written.push(appAbs);

  // 4. Post-grep — deprecated package guardrail.
  for (const p of written) {
    const body = readFileSync(p, "utf8");
    if (/fhevmjs/.test(body)) {
      for (const w of written) {
        try {
          rmSync(w);
        } catch {
          /* ignore */
        }
      }
      return {
        ok: false,
        written: [],
        error: `post-grep tripwire: '${p}' contains 'fhevmjs' — deprecated package detected, aborting.`,
      };
    }
  }

  return { ok: true, written, variant };
}

// ─── CLI shim ────────────────────────────────────────────────────────────────

interface CliArgs {
  contract: string | null;
  withWagmi: boolean;
  force: boolean;
  workspace: string;
  variant?: Variant;
  contractAddress?: string;
}

function parseArgs(args: string[]): CliArgs {
  const out: CliArgs = { contract: null, withWagmi: false, force: false, workspace: cwd() };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--contract") out.contract = args[++i] ?? null;
    else if (a === "--with-wagmi") out.withWagmi = true;
    else if (a === "--force") out.force = true;
    else if (a === "--workspace") out.workspace = resolve(args[++i] ?? cwd());
    else if (a === "--variant") {
      const v = args[++i] ?? "";
      if (["token", "voting", "wrapper", "auction", "custom"].includes(v)) {
        out.variant = v as Variant;
      }
    } else if (a === "--contract-address") out.contractAddress = args[++i];
  }
  return out;
}

const isEntry = argv[1] !== undefined && fileURLToPath(import.meta.url) === argv[1];

if (isEntry) {
  const cli = parseArgs(argv.slice(2));
  if (!cli.contract) {
    stderr.write(
      "usage: tsx generate.ts --contract <Name> [--with-wagmi] [--force] [--workspace <dir>] [--variant <token|voting|wrapper|auction|custom>] [--contract-address 0x…]\n",
    );
    exit(2);
  }
  void generateFrontend({
    workspaceRoot: cli.workspace,
    contract: cli.contract,
    withWagmi: cli.withWagmi,
    force: cli.force,
    variant: cli.variant,
    contractAddress: cli.contractAddress,
  }).then((r) => {
    if (r.ok) {
      stdout.write(JSON.stringify({ ok: true, variant: r.variant, written: r.written }, null, 2) + "\n");
      stderr.write(`✓ /zama-frontend (variant=${r.variant}) wrote ${r.written.length} file(s):\n`);
      for (const p of r.written) stderr.write(`  - ${p}\n`);
      exit(0);
    } else {
      stderr.write(`✗ /zama-frontend failed: ${r.error}\n`);
      exit(1);
    }
  });
}
