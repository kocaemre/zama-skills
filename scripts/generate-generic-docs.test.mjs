/**
 * Tests for scripts/generate-generic-docs.mjs (DIST-02 / 06-02).
 *
 * Generator contract:
 *   - generateGenericDoc({ skillPath }): { name, content }
 *       returns generic-doc text for a single SKILL.md.
 *   - generateAll({ outDir? }): Promise<string[]>
 *       writes one generic/<name>.md per skill; returns absolute output paths.
 *
 * Determinism is part of the contract — re-running generateAll() twice
 * MUST produce byte-identical output (drift gate depends on this).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  generateGenericDoc,
  generateAll,
} from "./generate-generic-docs.mjs";

const REPO_ROOT = resolve(new URL(".", import.meta.url).pathname, "..");
const SKILLS_DIR = join(REPO_ROOT, "plugins", "zama-skills", "skills");
const INIT_SKILL = join(SKILLS_DIR, "init", "SKILL.md");

describe("generateGenericDoc — single SKILL", () => {
  it("Test 1: emits the source skill name and description in the output", () => {
    const out = generateGenericDoc({ skillPath: INIT_SKILL });
    expect(out).toContain("name: init");
    // description text from init SKILL.md
    expect(out).toContain("Scaffold a new confidential dApp");
  });

  it("Test 2: stamps source_sha equal to `git hash-object <skill>`", () => {
    const expectedSha = execSync(`git hash-object "${INIT_SKILL}"`, {
      cwd: REPO_ROOT,
    })
      .toString()
      .trim();
    const out = generateGenericDoc({ skillPath: INIT_SKILL });
    expect(out).toContain(`source_sha: ${expectedSha}`);
  });

  it("Test 3: includes plugin-relative source pointer", () => {
    const out = generateGenericDoc({ skillPath: INIT_SKILL });
    expect(out).toContain(
      "source: plugins/zama-skills/skills/init/SKILL.md",
    );
  });

  it("Test 4: strips Claude-specific frontmatter keys and re-publishes them in a Claude-specific notes appendix", () => {
    const out = generateGenericDoc({ skillPath: INIT_SKILL });
    const fmMatch = out.match(/^---\n([\s\S]*?)\n---/);
    expect(fmMatch, "expected leading YAML frontmatter").toBeTruthy();
    const frontmatter = fmMatch[1];
    // Forbidden in the (rendered) frontmatter:
    expect(frontmatter).not.toMatch(/^allowed-tools:/m);
    expect(frontmatter).not.toMatch(/^disable-model-invocation:/m);
    expect(frontmatter).not.toMatch(/^context:\s*fork/m);
    // But the values must be preserved verbatim in the appendix:
    expect(out).toContain("## Claude-specific notes");
    // init SKILL.md uses `context: fork` and an `allowed-tools` whitelist.
    expect(out).toMatch(/allowed-tools.*Bash\(git/);
    expect(out).toContain("context: fork");
  });

  it("Test 5: replaces ${CLAUDE_SKILL_DIR} substring with <plugin-skill-dir> and explains the substitution", () => {
    // We synthesize an inline SKILL.md by passing `skillContent` directly so the
    // test does not depend on whether init SKILL.md happens to use the token.
    const synthetic = `---
name: synthetic
description: synthetic skill
---
Run \${CLAUDE_SKILL_DIR}/scripts/foo.mjs to do the thing.
`;
    const out = generateGenericDoc({
      skillPath: INIT_SKILL, // any real path so source_sha resolves
      skillContent: synthetic,
      skillName: "synthetic",
    });
    expect(out).toContain("<plugin-skill-dir>/scripts/foo.mjs");
    expect(out).not.toContain("${CLAUDE_SKILL_DIR}");
    // Footnote / explanatory text MUST be present.
    expect(out.toLowerCase()).toContain("<plugin-skill-dir>");
    expect(out).toMatch(/CLAUDE_SKILL_DIR|plugin-skill-dir/);
  });
});

describe("generateAll — write all 5 generic docs", () => {
  let outDir;
  let writtenPaths;

  beforeAll(async () => {
    outDir = mkdtempSync(join(tmpdir(), "generic-docs-"));
    writtenPaths = await generateAll({ outDir });
  });

  it("Test 6: writes 9 files named after the skills (init/contract/test/deploy/frontend/design/audit/debug/doctor)", () => {
    expect(writtenPaths).toHaveLength(9);
    const names = readdirSync(outDir).sort();
    expect(names).toEqual(
      ["audit.md", "contract.md", "debug.md", "deploy.md", "design.md", "doctor.md", "frontend.md", "init.md", "test.md"].sort(),
    );
    for (const name of names) {
      expect(existsSync(join(outDir, name))).toBe(true);
    }
  });

  it("Test 7: re-running generateAll() produces byte-identical output (deterministic)", async () => {
    const outDir2 = mkdtempSync(join(tmpdir(), "generic-docs-"));
    await generateAll({ outDir: outDir2 });
    for (const name of readdirSync(outDir)) {
      const a = readFileSync(join(outDir, name), "utf8");
      const b = readFileSync(join(outDir2, name), "utf8");
      expect(b, `mismatch in ${name}`).toBe(a);
    }
  });
});
