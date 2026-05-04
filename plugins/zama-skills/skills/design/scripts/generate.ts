/**
 * generate.ts — orchestrator for /zama-design blueprint generation.
 *
 * Pipeline:
 *   1. Validate inputs (delegates to templates.validateInputs).
 *   2. Render DESIGN.md + UI-WIREFRAME.md substitution maps.
 *   3. Read assets/templates/*.tpl, apply substitutions.
 *   4. Refuse to overwrite an existing target dir without --force.
 *   5. Post-render deprecation guard — refuse output containing
 *      `fhevmjs` or root-pkg `fhevm` import. (Templates are clean by
 *      construction; this exists so a future regression fails loud.)
 *   6. Write the two files under .planning/v1-design/<slug>/.
 *
 * No `Co-Authored-By: Claude` trailer — convention enforced by SKILL.md.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, exit, stderr, stdout } from "node:process";

import {
  applySubs,
  renderDesignSubs,
  renderWireframeSubs,
  validateInputs,
  type DesignInputs,
} from "./lib/templates.ts";

export interface GenerateDesignOptions {
  cwd?: string;
  inputs: DesignInputs;
  force?: boolean;
  /** Override the wall-clock for deterministic tests. */
  now?: Date;
}

export interface GenerateDesignResult {
  designPath: string;
  wireframePath: string;
  outDir: string;
}

function locateTemplatesRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "assets", "templates");
}

function readTemplate(name: string): string {
  const p = resolve(locateTemplatesRoot(), name);
  if (!existsSync(p)) {
    throw new Error(`Template missing: ${p}`);
  }
  return readFileSync(p, "utf8");
}

function checkDeprecatedImports(source: string, label: string): void {
  // Match only ACTUAL import/require/from statements — not prose mentions
  // (the templates legitimately discuss why fhevmjs is deprecated).
  const importPatterns: ReadonlyArray<readonly [RegExp, string, string]> = [
    [/\bfrom\s+["']fhevmjs["']/, "fhevmjs", "@zama-fhe/relayer-sdk"],
    [/\bimport\s+["']fhevmjs["']/, "fhevmjs", "@zama-fhe/relayer-sdk"],
    [/\brequire\(\s*["']fhevmjs["']\s*\)/, "fhevmjs", "@zama-fhe/relayer-sdk"],
    [/\bfrom\s+["']fhevm["']/, "fhevm (root pkg)", "@fhevm/solidity"],
    [/\bimport\s+["']fhevm["']/, "fhevm (root pkg)", "@fhevm/solidity"],
    [/\brequire\(\s*["']fhevm["']\s*\)/, "fhevm (root pkg)", "@fhevm/solidity"],
  ];
  for (const [re, name, replacement] of importPatterns) {
    if (re.test(source)) {
      throw new Error(
        `${label}: rendered output imports deprecated package \`${name}\`. Use \`${replacement}\` instead.`,
      );
    }
  }
}

export function generateDesign(
  opts: GenerateDesignOptions,
): GenerateDesignResult {
  const cwd = resolve(opts.cwd ?? process.cwd());
  const now = opts.now ?? new Date();

  // Step 1 — validate (throws on bad slug / unknown enum).
  validateInputs(opts.inputs);

  // Step 2 — render substitutions.
  const designSubs = renderDesignSubs(opts.inputs, now);
  const wireSubs = renderWireframeSubs(opts.inputs, now);

  // Step 3 — apply against templates.
  const designTpl = readTemplate("DESIGN.md.tpl");
  const wireTpl = readTemplate("UI-WIREFRAME.md.tpl");
  const designOut = applySubs(designTpl, designSubs as Record<string, string>);
  const wireOut = applySubs(wireTpl, wireSubs as Record<string, string>);

  // Step 5 — deprecation guard (post-render).
  checkDeprecatedImports(designOut, "DESIGN.md");
  checkDeprecatedImports(wireOut, "UI-WIREFRAME.md");

  // Step 4 — refuse overwrite without --force.
  const outDir = resolve(cwd, ".planning", "v1-design", opts.inputs.slug);
  const designPath = resolve(outDir, "DESIGN.md");
  const wirePath = resolve(outDir, "UI-WIREFRAME.md");
  if ((existsSync(designPath) || existsSync(wirePath)) && !opts.force) {
    throw new Error(
      `Design dir exists: ${outDir} — pass force=true (or --force on CLI) to overwrite.`,
    );
  }

  // Step 6 — write.
  mkdirSync(outDir, { recursive: true });
  writeFileSync(designPath, designOut, "utf8");
  writeFileSync(wirePath, wireOut, "utf8");

  return { designPath, wireframePath: wirePath, outDir };
}

// ---------------- CLI ----------------

interface CliArgs {
  inputs: DesignInputs;
  force: boolean;
}

function parseArgs(args: string[]): CliArgs {
  let inputsJson: string | undefined;
  let force = false;
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--inputs") {
      inputsJson = args[i + 1];
      i += 1;
    } else if (a === "--force") {
      force = true;
    }
  }
  if (!inputsJson) {
    throw new Error(
      "generate.ts: --inputs <json> required. Pass a JSON DesignInputs object: " +
        '{"slug":"my-dapp","category":"voting","confidential":"amounts","decryption":"each-user-sees-own","oneLiner":"..."}.',
    );
  }
  const parsed = JSON.parse(inputsJson) as DesignInputs;
  return { inputs: parsed, force };
}

const isDirectInvocation =
  argv[1] !== undefined &&
  resolve(argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectInvocation) {
  try {
    const { inputs, force } = parseArgs(argv.slice(2));
    const r = generateDesign({ inputs, force });
    stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          slug: inputs.slug,
          category: inputs.category,
          decryption: inputs.decryption,
          designPath: r.designPath,
          wireframePath: r.wireframePath,
          outDir: r.outDir,
          next: "/zama-init (use the matching use-case option, then keep DESIGN.md open while answering)",
          verification:
            "Every recommendation in DESIGN.md was grounded against context7 /zama-ai/fhevm at design time — no hallucinated APIs.",
        },
        null,
        2,
      )}\n`,
    );
    exit(0);
  } catch (err) {
    stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    exit(1);
  }
}
