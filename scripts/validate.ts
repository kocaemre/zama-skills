import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';

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
  for (const line of body.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const kv = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const raw = kv[2];
    if (key === undefined || raw === undefined) continue;
    let v = raw.trim();
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

async function main() {
  const errors: string[] = [];

  // 1. marketplace.json
  const mpRaw = await fs.readFile('.claude-plugin/marketplace.json', 'utf8');
  const mpJson = JSON.parse(mpRaw);
  const mp = MarketplaceSchema.parse(mpJson);
  if (RESERVED_MARKETPLACE_NAMES.has(mp.name)) {
    errors.push(`marketplace.name "${mp.name}" is on the reserved list`);
  }
  const firstPluginRaw = mpJson.plugins?.[0] ?? {};
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
  const plJson = JSON.parse(plRaw);
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
}

main().catch((e) => {
  console.error('✗ Validator crashed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
