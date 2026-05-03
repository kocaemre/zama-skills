/**
 * closing-summary.ts — Renderer for Phase 4 per-skill closing summaries.
 *
 * Resolves a markdown fragment from `shared/prompts/closing-summary-<skill>.md`
 * (single source of truth for the contract→test→deploy→frontend→ship chain)
 * and substitutes `{{var}}` placeholders from a caller-supplied vars map.
 *
 * Unknown placeholders are intentionally LEFT IN PLACE so authors notice
 * missing data instead of getting silently blanked output.
 *
 * Phase 2's transclusion engine (`scripts/build.ts`) materializes the same
 * fragments into the skill SKILL.md via `@sync:prompt:closing-summary-<skill>`
 * markers; this renderer is for runtime use inside each skill's scripts/.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type Phase4Skill = "contract" | "test" | "deploy" | "frontend";

const KNOWN_SKILLS: ReadonlySet<string> = new Set<Phase4Skill>([
  "contract",
  "test",
  "deploy",
  "frontend",
]);

/** Resolve `<plugin-root>/shared/prompts/` from this module's location. */
function defaultPromptsDir(): string {
  // skills/_lib/closing-summary.ts → ../../shared/prompts
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "shared", "prompts");
}

export interface RenderOptions {
  /** Override the prompts dir (tests). */
  promptsDir?: string;
}

/**
 * Render `shared/prompts/closing-summary-<skill>.md` with `{{key}}`
 * substitution. Throws if `skill` is not one of the known Phase 4 skills.
 *
 * Unknown placeholders (keys present in the template but absent from
 * `vars`) are left as-is so the author sees them in output and can fix.
 */
export function renderClosingSummary(
  skill: Phase4Skill,
  vars: Record<string, string>,
  opts: RenderOptions = {},
): string {
  if (!KNOWN_SKILLS.has(skill)) {
    throw new Error(
      `renderClosingSummary: unknown skill "${skill}". Expected one of: contract, test, deploy, frontend.`,
    );
  }

  const promptsDir = opts.promptsDir ?? defaultPromptsDir();
  const fragmentPath = resolve(promptsDir, `closing-summary-${skill}.md`);

  let template: string;
  try {
    template = readFileSync(fragmentPath, "utf8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `renderClosingSummary: failed to read fragment ${fragmentPath} (${msg})`,
    );
  }

  // Replace `{{key}}` only when the key is in `vars`. Keys not in `vars`
  // remain in the output verbatim so missing data is visible.
  return template.replace(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return vars[key] ?? match;
    }
    return match;
  });
}
