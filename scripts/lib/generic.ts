/**
 * Generate `generic/<skill>.md` rehber from a fully-expanded SKILL.md.
 *
 * As of 06-02 (DIST-02), the canonical generator lives at
 * `scripts/generate-generic-docs.mjs` (zero-deps, deterministic, with SHA
 * stamping + Claude-syntax stripping + appendix). This wrapper exists so the
 * `pnpm sync` engine (`scripts/build.ts`) keeps a single import surface and
 * always emits identical output to the standalone generator.
 *
 * If you find yourself duplicating logic between the two files, delete the
 * duplicate and have one delegate to the other.
 */

import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// `.mjs` import works because moduleResolution: "bundler" / "nodenext" tolerates it,
// and `tsx` (the runtime) defers to Node's loader which resolves `.mjs` natively.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error -- runtime ESM module without .d.ts
import { generateGenericDoc } from "../generate-generic-docs.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..");
const SKILLS_DIR = join(REPO_ROOT, "plugins", "zama-skills", "skills");

export function generateGenericFromSkill(
  skillName: string,
  skillContent: string,
): string {
  // Pass the *expanded* SKILL.md content (post @sync marker expansion + @pin
  // resolution) to the canonical generator. We hand it a synthetic skillPath so
  // SHA stamping uses the on-disk SKILL.md (the SHA reflects the source of
  // truth, not the post-expansion text — that's what we want for drift gating).
  const skillPath = join(SKILLS_DIR, skillName, "SKILL.md");
  return generateGenericDoc({
    skillPath,
    skillContent,
    skillName,
  });
}
