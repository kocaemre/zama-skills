/**
 * Generate `generic/<skill>.md` rehber from a fully-expanded SKILL.md.
 *
 * Strategy:
 *   - Strip the leading YAML frontmatter (between `---` ... `---`).
 *   - Prepend an auto-generated header pointing maintainers at `pnpm sync`.
 *   - Leave the rest of the markdown untouched (markers should already be expanded).
 */

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

export function generateGenericFromSkill(
  skillName: string,
  skillContent: string,
): string {
  const stripped = skillContent.replace(FRONTMATTER_RE, "");
  const header = `> Auto-generated from plugins/zama-skills/skills/${skillName}/SKILL.md — do not edit manually. Run \`pnpm sync\` to regenerate.\n\n`;
  // Ensure exactly one blank line between header and body.
  return header + stripped.replace(/^\s+/, "");
}
