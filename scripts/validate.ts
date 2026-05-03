import { z } from 'zod';
import fs from 'node:fs/promises';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { runSync } from './build.js';
import { listAllPackages } from './lib/versions.js';

// ────────────────────────────────────────────────────────────────────────────
// Marketplace + plugin schemas
// ────────────────────────────────────────────────────────────────────────────

const KebabCase = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]*$/,
    'must be kebab-case (lowercase letters/digits/hyphens, start with letter/digit)',
  );

const RelativeSource = z
  .string()
  .regex(/^\.\//, "source must start with './'")
  .refine((s) => !s.includes('..'), { message: "source must not contain '..'" });

const MarketplacePluginEntry = z.object({
  name: KebabCase,
  source: RelativeSource,
  description: z.string().optional(),
  version: z.string().optional(),
  homepage: z.string().optional(),
  repository: z.string().optional(),
  license: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  category: z.string().optional(),
});

const MarketplaceSchema = z.object({
  $schema: z.string().optional(),
  name: KebabCase,
  description: z.string().optional(),
  owner: z.object({
    name: z.string().min(1),
    email: z.string().email().optional(),
  }),
  plugins: z.array(MarketplacePluginEntry).min(1),
});

const PluginSchema = z.object({
  name: KebabCase,
  description: z.string().optional(),
  version: z.string().optional(),
  author: z
    .object({ name: z.string(), email: z.string().email().optional() })
    .optional(),
  homepage: z.string().optional(),
  repository: z.string().optional(),
  license: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

const RESERVED_MARKETPLACE_NAMES = new Set([
  'claude-code-marketplace',
  'claude-code-plugins',
  'claude-plugins-official',
  'anthropic-marketplace',
  'anthropic-plugins',
  'agent-skills',
  'knowledge-work-plugins',
  'life-sciences',
]);

// ────────────────────────────────────────────────────────────────────────────
// SKILL.md frontmatter schema
// ────────────────────────────────────────────────────────────────────────────

const SkillFrontmatterSchema = z
  .object({
    name: z
      .string()
      .regex(/^[a-z0-9-]+$/, 'skill name must be kebab-case')
      .max(64),
    description: z.string().min(1),
    when_to_use: z.string().min(1),
    'allowed-tools': z.string().min(1, 'allowed-tools must be a non-empty whitelist'),
    'disable-model-invocation': z.boolean().optional(),
    context: z.enum(['inline', 'fork']).optional(),
    agent: z.string().optional(),
  })
  .refine(
    (fm) => fm.description.length + fm.when_to_use.length <= 1536,
    { message: 'combined description + when_to_use must be ≤ 1,536 chars' },
  );

// ────────────────────────────────────────────────────────────────────────────
// Minimal YAML-frontmatter parser (no gray-matter dep needed for Phase 1)
// ────────────────────────────────────────────────────────────────────────────

function parseFrontmatter(md: string): Record<string, unknown> {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m || !m[1]) throw new Error('SKILL.md missing YAML frontmatter (--- block)');
  const body: string = m[1];
  const out: Record<string, unknown> = {};
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const kv = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const raw = kv[2];
    if (key === undefined || raw === undefined) continue;
    let v = raw.trim();
    // Detect block-style YAML list (next non-empty line starts with `  - `).
    // The minimal parser does not support lists; surface a precise error so
    // authors don't get a confusing Zod "must be a non-empty whitelist" on a
    // perfectly valid YAML list. Comma-separated string is required instead.
    if (v === '') {
      let j = i + 1;
      while (j < lines.length && lines[j]!.trim() === '') j++;
      const next = lines[j];
      if (next && /^\s+-\s+/.test(next)) {
        throw new Error(
          `frontmatter key "${key}" uses YAML list syntax (\`  - item\`); this minimal parser only supports inline scalars. Use a comma-separated string: ${key}: "Read, Write, Edit"`,
        );
      }
    }
    // Strip surrounding single/double quotes if present
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (v === 'true') out[key] = true;
    else if (v === 'false') out[key] = false;
    else out[key] = v;
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

const EXPECTED_SKILLS = ['init', 'contract', 'test', 'deploy', 'frontend'] as const;
const PLUGIN_DIR = 'plugins/zama-skills';
const SKILLS_ROOT = `${PLUGIN_DIR}/skills`;

// ────────────────────────────────────────────────────────────────────────────
// Init asset audit (Phase 03-07)
// ────────────────────────────────────────────────────────────────────────────

const INIT_ASSETS_REL = `${PLUGIN_DIR}/skills/init/assets`;

/**
 * Whitelist of required init-skill assets. Every entry MUST exist on disk
 * relative to the repo root, or the audit fails. The list mirrors the file
 * inventory documented in 03-07-PLAN and produced by phases 03-02..05.
 */
const REQUIRED_INIT_ASSETS: readonly string[] = [
  // Root templates
  `${INIT_ASSETS_REL}/templates/pnpm-workspace.yaml.tpl`,
  `${INIT_ASSETS_REL}/templates/root-package.json.tpl`,
  `${INIT_ASSETS_REL}/templates/root-readme.md.tpl`,
  `${INIT_ASSETS_REL}/templates/.env.example.tpl`,
  `${INIT_ASSETS_REL}/templates/.gitignore.tpl`,
  // Contracts package
  `${INIT_ASSETS_REL}/templates/packages/contracts/package.json.tpl`,
  `${INIT_ASSETS_REL}/templates/packages/contracts/hardhat.config.ts.tpl`,
  `${INIT_ASSETS_REL}/templates/packages/contracts/tsconfig.json.tpl`,
  // Frontend package
  `${INIT_ASSETS_REL}/templates/packages/frontend/package.json.tpl`,
  `${INIT_ASSETS_REL}/templates/packages/frontend/vite.config.ts.tpl`,
  `${INIT_ASSETS_REL}/templates/packages/frontend/index.html.tpl`,
  `${INIT_ASSETS_REL}/templates/packages/frontend/src/main.tsx.tpl`,
  `${INIT_ASSETS_REL}/templates/packages/frontend/src/App.tsx.tpl`,
  // Use-case seeds
  `${INIT_ASSETS_REL}/seeds/confidential-token/Token.sol`,
  `${INIT_ASSETS_REL}/seeds/voting/Poll.sol`,
  `${INIT_ASSETS_REL}/seeds/auction/SealedBidAuction.sol`,
  `${INIT_ASSETS_REL}/seeds/custom/Skeleton.sol`,
];

const PIN_REGEX = /<!--\s*@pin:([^\s>]+)\s*-->/g;

/** Comment-line allowlist mirrors scaffold.ts isCommentLine — Skeleton.sol's
 * deprecation-guard banner legitimately mentions deprecated names. */
function isCommentLine(line: string): boolean {
  const t = line.replace(/^\s+/, '');
  return (
    t.startsWith('//') ||
    t.startsWith('*') ||
    t.startsWith('/*') ||
    t.startsWith('#')
  );
}

function walkFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walkFiles(p, out);
    else out.push(p);
  }
  return out;
}

/**
 * Audit init-skill assets:
 *   1. Required-files whitelist exists on disk.
 *   2. Every `<!-- @pin:<key> -->` references a known package (or the
 *      `solc` compiler key, or the `@zama-fhe/relayer-sdk-dev` alias).
 *   3. No non-comment line in templates/seeds contains `fhevmjs` or `"fhevm":`.
 *
 * Pure I/O over the given rootDir; returns aggregated errors so the caller
 * can pretty-print and exit non-zero.
 */
export function auditInitAssets(rootDir: string): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const assetsDir = path.join(rootDir, INIT_ASSETS_REL);

  // 1. Required-files check
  for (const rel of REQUIRED_INIT_ASSETS) {
    const abs = path.join(rootDir, rel);
    if (!existsSync(abs)) {
      errors.push(`Asset audit failed: required asset missing: ${rel}`);
    }
  }

  // Build the set of known pin keys.
  const knownKeys = new Set<string>([
    ...listAllPackages(),
    'solc', // compiler.solc top-level key
  ]);

  // 2 + 3. Walk all template + seed files.
  const allFiles = walkFiles(assetsDir);
  for (const abs of allFiles) {
    const rel = path.relative(rootDir, abs);
    let text: string;
    try {
      text = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }

    // 2. Pin-key check (only meaningful for templates with placeholders).
    if (rel.endsWith('.tpl')) {
      const matches = text.matchAll(PIN_REGEX);
      for (const m of matches) {
        const key = m[1];
        if (!key) continue;
        if (!knownKeys.has(key)) {
          errors.push(
            `Asset audit failed: unknown @pin key '${key}' in ${rel} — add to pinned-versions.json or remove`,
          );
        }
      }
    }

    // 3. Deprecation grep (skip comment lines).
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const raw = lines[i] ?? '';
      if (isCommentLine(raw)) continue;
      let token: string | null = null;
      if (/\bfhevmjs\b/.test(raw)) token = 'fhevmjs';
      else if (/"fhevm"\s*:/.test(raw)) token = '"fhevm":';
      if (token !== null) {
        errors.push(
          `Asset audit failed: deprecated identifier '${token}' in ${rel}:${i + 1}`,
        );
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

async function runSyncCheck(): Promise<{ changed: string[]; errors: string[] }> {
  return runSync({ check: true });
}


async function main() {
  const argv = process.argv.slice(2);
  const skipSync = argv.includes('--skip-sync');
  const errors: string[] = [];

  // 1. marketplace.json
  const mpPath = '.claude-plugin/marketplace.json';
  const mpRaw = await fs.readFile(mpPath, 'utf8');
  let mpJson: unknown;
  try {
    mpJson = JSON.parse(mpRaw);
  } catch (e) {
    throw new Error(
      `Invalid JSON in ${mpPath}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  const mp = MarketplaceSchema.parse(mpJson);
  if (RESERVED_MARKETPLACE_NAMES.has(mp.name)) {
    errors.push(`marketplace.name "${mp.name}" is on the reserved list`);
  }
  const firstPluginRaw =
    (mpJson as { plugins?: Array<Record<string, unknown>> }).plugins?.[0] ?? {};
  const firstPlugin = mp.plugins[0];
  if (firstPlugin && firstPlugin.source !== `./${PLUGIN_DIR}`) {
    errors.push(
      `plugins[0].source must be "./${PLUGIN_DIR}", got "${firstPlugin.source}"`,
    );
  }
  if (Object.prototype.hasOwnProperty.call(firstPluginRaw, 'version')) {
    errors.push(
      'plugins[0].version should be omitted during dev (commit SHA = version); pin only at submission',
    );
  }

  // 2. plugin.json
  const plPath = `${PLUGIN_DIR}/.claude-plugin/plugin.json`;
  const plRaw = await fs.readFile(plPath, 'utf8');
  let plJson: unknown;
  try {
    plJson = JSON.parse(plRaw);
  } catch (e) {
    throw new Error(
      `Invalid JSON in ${plPath}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  const pl = PluginSchema.parse(plJson);
  if (pl.name !== 'zama-skills') {
    errors.push(`plugin.name must be "zama-skills", got "${pl.name}"`);
  }
  if (Object.prototype.hasOwnProperty.call(plJson, 'version')) {
    errors.push(
      'plugin.json version should be omitted during dev; pin only at submission',
    );
  }

  // 3. .claude-plugin directory must contain ONLY plugin.json
  const pluginCpEntries: string[] = await fs.readdir(`${PLUGIN_DIR}/.claude-plugin`);
  if (pluginCpEntries.length !== 1 || pluginCpEntries[0] !== 'plugin.json') {
    errors.push(
      `${PLUGIN_DIR}/.claude-plugin must contain only plugin.json, got: ${pluginCpEntries.join(', ')}`,
    );
  }

  // 4. All 5 SKILL.md files exist with correct invariants
  for (const slug of EXPECTED_SKILLS) {
    const p = path.join(SKILLS_ROOT, slug, 'SKILL.md');
    let content: string;
    try {
      content = await fs.readFile(p, 'utf8');
    } catch {
      errors.push(`Missing skill file: ${p}`);
      continue;
    }
    let fm: z.infer<typeof SkillFrontmatterSchema>;
    try {
      const parsed = parseFrontmatter(content);
      fm = SkillFrontmatterSchema.parse(parsed);
    } catch (e) {
      errors.push(
        `${p} frontmatter invalid: ${e instanceof Error ? e.message : String(e)}`,
      );
      continue;
    }
    if (fm.name !== slug) {
      errors.push(`${p}: name "${fm.name}" must match folder "${slug}"`);
    }
    // disable-model-invocation: positive AND negative check (only deploy)
    if (slug === 'deploy') {
      if (fm['disable-model-invocation'] !== true) {
        errors.push(
          `${p}: deploy skill MUST have disable-model-invocation: true (PLUGIN-03)`,
        );
      }
    } else {
      if (fm['disable-model-invocation'] === true) {
        errors.push(
          `${p}: only deploy skill should have disable-model-invocation: true`,
        );
      }
    }
    // context: fork — positive AND negative check (only init)
    if (slug === 'init') {
      if (fm.context !== 'fork') {
        errors.push(
          `${p}: init skill MUST have context: fork (CONTEXT D-frontmatter)`,
        );
      }
    } else {
      if (fm.context === 'fork') {
        errors.push(`${p}: only init skill should have context: fork`);
      }
    }
  }

  if (errors.length) {
    console.error('✗ Validation FAILED:\n');
    for (const e of errors) console.error('  • ' + e);
    process.exit(1);
  }
  console.log('✓ marketplace + plugin + 5 SKILL.md frontmatters valid');

  // Phase 2 SHARED-04: sync drift check (unless explicitly skipped).
  if (!skipSync) {
    const syncRes = await runSyncCheck();
    if (syncRes.errors.length > 0) {
      console.error('\x1b[31m✗ Drift / fatal sync issues:\x1b[0m');
      for (const e of syncRes.errors) console.error('\x1b[31m  - ' + e + '\x1b[0m');
      console.error('\x1b[33mDrift detected. Run `pnpm sync` and commit the result.\x1b[0m');
      process.exit(1);
    }
    console.log('✓ No drift detected across sync targets');
  }

  // Phase 03-07: init-skill asset audit (required files, @pin keys, deprecation grep).
  const auditRes = auditInitAssets(process.cwd());
  if (!auditRes.ok) {
    console.error('\x1b[31m✗ Init asset audit failed:\x1b[0m');
    for (const e of auditRes.errors) console.error('\x1b[31m  - ' + e + '\x1b[0m');
    process.exit(1);
  }
  console.log('✓ Init asset audit passed (required files, @pin keys, deprecation grep)');
}

export { runSyncCheck };

const invokedDirect = (() => {
  const arg1 = process.argv[1];
  if (!arg1) return false;
  return arg1.endsWith('scripts/validate.ts') || arg1.endsWith('validate.ts');
})();
if (invokedDirect) {
  main().catch((e) => {
    console.error('✗ Validator crashed:', e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
