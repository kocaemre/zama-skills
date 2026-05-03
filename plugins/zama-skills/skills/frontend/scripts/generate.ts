/**
 * generate.ts — runtime orchestrator for `/zama-frontend`.
 *
 * Materializes 3 templates into a /zama-init'd workspace:
 *   - packages/frontend/src/lib/fhe.ts            (or fhe.ts via wagmi shim with --with-wagmi)
 *   - packages/frontend/src/hooks/useDecrypted.ts
 *   - packages/frontend/src/components/EncryptedInput.tsx
 *
 * Performs preflight (typechain v6 / ethers v6) before write, and a post-grep
 * for the literal `fhevmjs` token (deprecated package guardrail) after write.
 *
 * CLI:
 *   tsx generate.ts --contract <Name> [--with-wagmi] [--force] [--workspace <dir>]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, exit, stderr, stdout, cwd } from "node:process";

import { runFrontendPreflight } from "./lib/preflight.js";

export interface GenerateOptions {
  workspaceRoot: string;
  contract: string;
  withWagmi?: boolean;
  force?: boolean;
}

export interface GenerateResult {
  ok: boolean;
  written: string[];
  error?: string;
}

interface OutputSpec {
  /** Template file under assets/templates/. */
  template: string;
  /** Destination path relative to workspaceRoot. */
  dest: string;
}

function locateTemplatesRoot(): string {
  // generate.ts lives at: <skill>/scripts/generate.ts
  // templates live at:    <skill>/assets/templates/
  const here = dirname(fileURLToPath(import.meta.url));
  const candidate = resolve(here, "..", "assets", "templates");
  if (!existsSync(candidate)) {
    throw new Error(`[generate] templates dir not found at ${candidate}`);
  }
  return candidate;
}

function specs(opts: GenerateOptions): OutputSpec[] {
  const fheTpl = opts.withWagmi ? "fhe-wagmi.ts.tpl" : "fhe.ts.tpl";
  return [
    { template: fheTpl, dest: "packages/frontend/src/lib/fhe.ts" },
    { template: "useDecrypted.ts.tpl", dest: "packages/frontend/src/hooks/useDecrypted.ts" },
    { template: "EncryptedInput.tsx.tpl", dest: "packages/frontend/src/components/EncryptedInput.tsx" },
  ];
}

function applySubstitutions(body: string, contract: string): string {
  // `__CONTRACT__` is the only token we substitute (used in EncryptedInput
  // ABI wiring comment). Templates are otherwise contract-agnostic.
  return body.replace(/__CONTRACT__/g, contract);
}

export async function generateFrontend(opts: GenerateOptions): Promise<GenerateResult> {
  const written: string[] = [];

  // 1. Preflight (defense in depth — SKILL.md should already have run it).
  const pre = runFrontendPreflight({ workspaceRoot: opts.workspaceRoot });
  if (!pre.ok) {
    return {
      ok: false,
      written: [],
      error: `preflight failed:\n  - ${pre.failures.join("\n  - ")}`,
    };
  }

  const templatesRoot = locateTemplatesRoot();
  const outputs = specs(opts);

  // 2. Refuse overwrite without --force.
  if (!opts.force) {
    const existing = outputs.filter((s) => existsSync(join(opts.workspaceRoot, s.dest)));
    if (existing.length > 0) {
      return {
        ok: false,
        written: [],
        error: `refusing to overwrite existing file(s): ${existing.map((e) => e.dest).join(", ")}. Pass --force to regenerate.`,
      };
    }
  }

  // 3. Materialize.
  for (const spec of outputs) {
    const tplPath = join(templatesRoot, spec.template);
    const destAbs = join(opts.workspaceRoot, spec.dest);
    const body = applySubstitutions(readFileSync(tplPath, "utf8"), opts.contract);
    mkdirSync(dirname(destAbs), { recursive: true });
    writeFileSync(destAbs, body, "utf8");
    written.push(destAbs);
  }

  // 4. Post-grep — deprecated package guardrail.
  for (const p of written) {
    const body = readFileSync(p, "utf8");
    if (/fhevmjs/.test(body)) {
      // Roll back the writes we just made.
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
        error: `post-grep tripwire: '${p}' contains 'fhevmjs' — deprecated package detected, aborting (see shared/deprecated-imports.json).`,
      };
    }
  }

  return { ok: true, written };
}

// ─── CLI shim ────────────────────────────────────────────────────────────────

interface CliArgs {
  contract: string | null;
  withWagmi: boolean;
  force: boolean;
  workspace: string;
}

function parseArgs(args: string[]): CliArgs {
  const out: CliArgs = { contract: null, withWagmi: false, force: false, workspace: cwd() };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--contract") {
      out.contract = args[++i] ?? null;
    } else if (a === "--with-wagmi") {
      out.withWagmi = true;
    } else if (a === "--force") {
      out.force = true;
    } else if (a === "--workspace") {
      out.workspace = resolve(args[++i] ?? cwd());
    }
  }
  return out;
}

const isEntry = argv[1] !== undefined && fileURLToPath(import.meta.url) === argv[1];

if (isEntry) {
  const cli = parseArgs(argv.slice(2));
  if (!cli.contract) {
    stderr.write("usage: tsx generate.ts --contract <Name> [--with-wagmi] [--force] [--workspace <dir>]\n");
    exit(2);
  }
  void generateFrontend({
    workspaceRoot: cli.workspace,
    contract: cli.contract,
    withWagmi: cli.withWagmi,
    force: cli.force,
  }).then((r) => {
    if (r.ok) {
      stdout.write(JSON.stringify({ ok: true, written: r.written }, null, 2) + "\n");
      stderr.write(`✓ /zama-frontend wrote ${r.written.length} file(s):\n`);
      for (const p of r.written) stderr.write(`  - ${p}\n`);
      exit(0);
    } else {
      stderr.write(`✗ /zama-frontend failed: ${r.error}\n`);
      exit(1);
    }
  });
}
