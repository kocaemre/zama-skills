/**
 * End-to-end drift detection for the validate + sync pipeline.
 *
 * Test plan (TDD):
 *   1. In-sync repo  → runSync({ check: true }) returns errors.length === 0
 *   2. Drifted SKILL.md (mutated body inside markers) → errors.length >= 1
 *      and the offending file path appears in the error list.
 *   3. Subprocess: spawn `tsx scripts/validate.ts` against a fixture with
 *      synthetic drift; assert exit code === 1 and stderr contains the
 *      canonical "Drift detected" message.
 *
 * The fixture is created by copying the live `plugins/`, `examples/`,
 * `pinned-versions.json`, `deprecated.json`, and `generic/` directories
 * into a temp dir, then mutating the init SKILL.md.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import fse from "fs-extra";

import { runSync } from "./build.js";

const REPO_ROOT = resolve(__dirname, "..");

function makeFixture(): string {
  const tmp = mkdtempSync(join(tmpdir(), "zama-validate-"));
  // Copy only what the sync engine reads/writes.
  fse.copySync(join(REPO_ROOT, "plugins"), join(tmp, "plugins"));
  fse.copySync(join(REPO_ROOT, "generic"), join(tmp, "generic"));
  if (fse.existsSync(join(REPO_ROOT, "examples"))) {
    fse.copySync(join(REPO_ROOT, "examples"), join(tmp, "examples"));
  }
  // pinned-versions.json + deprecated-imports.json live under
  // plugins/zama-skills/shared/ and were already copied above.
  // .claude-plugin needed only for the validate.ts subprocess test.
  fse.copySync(
    join(REPO_ROOT, ".claude-plugin"),
    join(tmp, ".claude-plugin"),
  );
  return tmp;
}

describe("runSync drift detection", () => {
  let fixture: string;

  beforeAll(() => {
    fixture = makeFixture();
  });

  afterAll(() => {
    rmSync(fixture, { recursive: true, force: true });
  });

  it("reports zero errors when fixture is in sync", async () => {
    const res = await runSync({ check: true, cwd: fixture });
    expect(res.errors).toEqual([]);
  });

  it("reports drift when a SKILL.md is mutated", async () => {
    const skillPath = join(
      fixture,
      "plugins/zama-skills/skills/init/SKILL.md",
    );
    const original = readFileSync(skillPath, "utf8");
    // Append a stray line at the end so transclusion + pin resolution will
    // normalize the file back; that means cwd-mode runSync({check:true})
    // will see a delta on disk vs expected.
    writeFileSync(skillPath, original + "\n<!-- drift sentinel -->\n", "utf8");
    try {
      const res = await runSync({ check: true, cwd: fixture });
      expect(res.errors.length).toBeGreaterThan(0);
      // Drift surfaces against the regenerated `generic/init.md` (derived from
      // the SKILL.md body, which now carries our sentinel).
      expect(res.errors.some((e) => e.includes("init"))).toBe(true);
    } finally {
      writeFileSync(skillPath, original, "utf8");
    }
  });

  it("validate.ts subprocess exits 1 with canonical message on drift", () => {
    const skillPath = join(
      fixture,
      "plugins/zama-skills/skills/contract/SKILL.md",
    );
    const original = readFileSync(skillPath, "utf8");
    writeFileSync(
      skillPath,
      original + "\n<!-- drift sentinel -->\n",
      "utf8",
    );
    try {
      const validateScript = join(REPO_ROOT, "scripts/validate.ts");
      const tsxBin = join(REPO_ROOT, "node_modules/.bin/tsx");
      const proc = spawnSync(tsxBin, [validateScript], {
        cwd: fixture,
        encoding: "utf8",
        env: { ...process.env },
      });
      expect(proc.status).toBe(1);
      const combined = (proc.stderr ?? "") + (proc.stdout ?? "");
      expect(combined).toContain("Drift detected");
    } finally {
      writeFileSync(skillPath, original, "utf8");
    }
  }, 30_000);

  it("reports drift for unknown @pin: package (HR-02)", async () => {
    // Inject a typo'd @pin: reference into a shared snippet that's transcluded
    // into multiple SKILL.md files. Without HR-02, this would silently produce
    // `<!-- @pin:nonexistent-pkg-typo (unresolved) -->` and `--check` would
    // pass on a re-run (idempotent). With the fix, runSync surfaces a
    // "Unknown @pin package" error.
    const snippetPath = join(
      fixture,
      "plugins/zama-skills/shared/snippets/versions-table.md",
    );
    const original = readFileSync(snippetPath, "utf8");
    writeFileSync(
      snippetPath,
      original + "\n<!-- @pin:nonexistent-pkg-typo -->\n",
      "utf8",
    );
    try {
      const res = await runSync({ check: true, cwd: fixture });
      expect(
        res.errors.some((e) =>
          e.includes("Unknown @pin package: nonexistent-pkg-typo"),
        ),
      ).toBe(true);
    } finally {
      writeFileSync(snippetPath, original, "utf8");
    }
  });

  it("validate.ts subprocess exits 0 when fixture is clean", () => {
    const validateScript = join(REPO_ROOT, "scripts/validate.ts");
    const tsxBin = join(REPO_ROOT, "node_modules/.bin/tsx");
    const proc = spawnSync(tsxBin, [validateScript], {
      cwd: fixture,
      encoding: "utf8",
      env: { ...process.env },
    });
    expect(proc.status).toBe(0);
  }, 30_000);
});
