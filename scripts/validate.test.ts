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
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import fse from "fs-extra";

import { runSync } from "./build.js";
import { auditInitAssets, auditPhase4Skills } from "./validate.js";

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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 03-07 — auditInitAssets coverage
// ─────────────────────────────────────────────────────────────────────────────

describe("auditInitAssets", () => {
  const cleanups: string[] = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      const dir = cleanups.pop()!;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function makeAuditFixture(): string {
    const tmp = mkdtempSync(join(tmpdir(), "zama-audit-"));
    cleanups.push(tmp);
    // Mirror the layout the auditor walks. Copy assets verbatim and shared
    // (pinned-versions.json) so listAllPackages() succeeds inside the lib.
    fse.copySync(
      join(REPO_ROOT, "plugins/zama-skills/skills/init/assets"),
      join(tmp, "plugins/zama-skills/skills/init/assets"),
    );
    fse.copySync(
      join(REPO_ROOT, "plugins/zama-skills/shared"),
      join(tmp, "plugins/zama-skills/shared"),
    );
    return tmp;
  }

  it("happy path — real repo passes with no errors", () => {
    const res = auditInitAssets(REPO_ROOT);
    expect(res.errors).toEqual([]);
    expect(res.ok).toBe(true);
  });

  it("missing required file — flags 'required asset missing'", () => {
    const tmp = makeAuditFixture();
    rmSync(
      join(
        tmp,
        "plugins/zama-skills/skills/init/assets/seeds/confidential-token/Token.sol",
      ),
    );
    const res = auditInitAssets(tmp);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes("required asset missing"))).toBe(
      true,
    );
    expect(res.errors.some((e) => e.includes("Token.sol"))).toBe(true);
  });

  it("unknown @pin key — flags the offending key + file", () => {
    const tmp = makeAuditFixture();
    const tplPath = join(
      tmp,
      "plugins/zama-skills/skills/init/assets/templates/packages/contracts/package.json.tpl",
    );
    const orig = readFileSync(tplPath, "utf8");
    writeFileSync(
      tplPath,
      orig + '\n"bogus-pkg": "<!-- @pin:not-a-real-pkg -->"\n',
      "utf8",
    );
    const res = auditInitAssets(tmp);
    expect(res.ok).toBe(false);
    expect(
      res.errors.some(
        (e) =>
          e.includes("unknown @pin key") && e.includes("'not-a-real-pkg'"),
      ),
    ).toBe(true);
  });

  it("deprecation hit on non-comment line — flags 'deprecated identifier'", () => {
    const tmp = makeAuditFixture();
    const seedPath = join(
      tmp,
      "plugins/zama-skills/skills/init/assets/seeds/custom/Skeleton.sol",
    );
    // Append a non-comment line containing the banned token.
    const orig = readFileSync(seedPath, "utf8");
    writeFileSync(seedPath, orig + '\nimport "fhevmjs";\n', "utf8");
    const res = auditInitAssets(tmp);
    expect(res.ok).toBe(false);
    expect(
      res.errors.some(
        (e) =>
          e.includes("deprecated identifier") && e.includes("Skeleton.sol"),
      ),
    ).toBe(true);
  });

  it("comment-line allowlist — '// fhevmjs note' does NOT trigger", () => {
    const tmp = makeAuditFixture();
    const seedPath = join(
      tmp,
      "plugins/zama-skills/skills/init/assets/seeds/custom/Skeleton.sol",
    );
    const orig = readFileSync(seedPath, "utf8");
    writeFileSync(seedPath, orig + "\n// fhevmjs note — purely a doc line\n", "utf8");
    const res = auditInitAssets(tmp);
    // Comment line must NOT raise a deprecation hit on this file/line.
    expect(
      res.errors.filter(
        (e) =>
          e.includes("deprecated identifier") && e.includes("Skeleton.sol"),
      ),
    ).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 04-06 — auditPhase4Skills coverage
// ─────────────────────────────────────────────────────────────────────────────

describe("auditPhase4Skills", () => {
  const cleanups: string[] = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      const dir = cleanups.pop()!;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function makePhase4Fixture(): string {
    const tmp = mkdtempSync(join(tmpdir(), "zama-phase4-audit-"));
    cleanups.push(tmp);
    // Mirror the layout the auditor walks: 4 Phase 4 skills + shared dir
    // (for deprecated-imports.json + pinned-versions.json).
    for (const slug of ["contract", "test", "deploy", "frontend"]) {
      fse.copySync(
        join(REPO_ROOT, `plugins/zama-skills/skills/${slug}`),
        join(tmp, `plugins/zama-skills/skills/${slug}`),
      );
    }
    fse.copySync(
      join(REPO_ROOT, "plugins/zama-skills/shared"),
      join(tmp, "plugins/zama-skills/shared"),
    );
    return tmp;
  }

  it("happy path — real repo passes auditPhase4Skills with no errors", () => {
    const res = auditPhase4Skills(REPO_ROOT);
    if (!res.ok) {
      // Surface details to make CI failures actionable.
      console.error("auditPhase4Skills errors:", res.errors);
    }
    expect(res.errors).toEqual([]);
    expect(res.ok).toBe(true);
  });

  it("missing required template — flags 'missing template'", () => {
    const tmp = makePhase4Fixture();
    rmSync(
      join(
        tmp,
        "plugins/zama-skills/skills/contract/assets/templates/contract.sol.tpl",
      ),
    );
    const res = auditPhase4Skills(tmp);
    expect(res.ok).toBe(false);
    expect(
      res.errors.some(
        (e) => e.includes("contract") && e.includes("contract.sol.tpl"),
      ),
    ).toBe(true);
  });

  it("missing required script — flags 'missing'", () => {
    const tmp = makePhase4Fixture();
    rmSync(
      join(
        tmp,
        "plugins/zama-skills/skills/deploy/scripts/lib/sepolia-addresses.ts",
      ),
    );
    const res = auditPhase4Skills(tmp);
    expect(res.ok).toBe(false);
    expect(
      res.errors.some(
        (e) => e.includes("deploy") && e.includes("sepolia-addresses.ts"),
      ),
    ).toBe(true);
  });

  it("deploy SKILL.md without disable-model-invocation — flags it", () => {
    const tmp = makePhase4Fixture();
    const skillPath = join(
      tmp,
      "plugins/zama-skills/skills/deploy/SKILL.md",
    );
    const original = readFileSync(skillPath, "utf8");
    const mutated = original.replace(
      /^disable-model-invocation:\s*true\s*$/m,
      "disable-model-invocation: false",
    );
    writeFileSync(skillPath, mutated, "utf8");
    const res = auditPhase4Skills(tmp);
    expect(res.ok).toBe(false);
    expect(
      res.errors.some(
        (e) =>
          e.includes("deploy") && e.includes("disable-model-invocation"),
      ),
    ).toBe(true);
  });

  it("missing allowed-tools in a skill frontmatter — flags it", () => {
    const tmp = makePhase4Fixture();
    const skillPath = join(
      tmp,
      "plugins/zama-skills/skills/contract/SKILL.md",
    );
    const original = readFileSync(skillPath, "utf8");
    const mutated = original.replace(/^allowed-tools:.*$/m, "");
    writeFileSync(skillPath, mutated, "utf8");
    const res = auditPhase4Skills(tmp);
    expect(res.ok).toBe(false);
    expect(
      res.errors.some(
        (e) => e.includes("contract") && e.includes("allowed-tools"),
      ),
    ).toBe(true);
  });

  it("deprecated 'fhevmjs' import injected into a frontend template — flagged", () => {
    const tmp = makePhase4Fixture();
    const tplPath = join(
      tmp,
      "plugins/zama-skills/skills/frontend/assets/templates/fhe.ts.tpl",
    );
    const original = readFileSync(tplPath, "utf8");
    writeFileSync(tplPath, original + '\nimport "fhevmjs";\n', "utf8");
    const res = auditPhase4Skills(tmp);
    expect(res.ok).toBe(false);
    expect(
      res.errors.some(
        (e) => e.includes("frontend") && e.includes("fhevmjs"),
      ),
    ).toBe(true);
    expect(res.errors.some((e) => e.includes("fhe.ts.tpl"))).toBe(true);
  });

  it("hex address pinned in deploy SKILL.md — flagged (DEPLOY-03)", () => {
    const tmp = makePhase4Fixture();
    const skillPath = join(
      tmp,
      "plugins/zama-skills/skills/deploy/SKILL.md",
    );
    const original = readFileSync(skillPath, "utf8");
    writeFileSync(
      skillPath,
      original +
        "\n\n<!-- pinned: 0x1234567890abcdef1234567890abcdef12345678 -->\n",
      "utf8",
    );
    const res = auditPhase4Skills(tmp);
    expect(res.ok).toBe(false);
    expect(
      res.errors.some(
        (e) => e.includes("deploy") && e.includes("hex address"),
      ),
    ).toBe(true);
  });

  it("hex address inside a deploy test fixture — NOT flagged (allowlist)", () => {
    const tmp = makePhase4Fixture();
    const fixtureDir = join(
      tmp,
      "plugins/zama-skills/skills/deploy/scripts/__fixtures__",
    );
    mkdirSync(fixtureDir, { recursive: true });
    writeFileSync(
      join(fixtureDir, "sample.json"),
      '{ "address": "0x1234567890abcdef1234567890abcdef12345678" }\n',
      "utf8",
    );
    const res = auditPhase4Skills(tmp);
    expect(
      res.errors.some(
        (e) => e.includes("hex address") && e.includes("__fixtures__"),
      ),
    ).toBe(false);
  });

  it("missing @sync:prompt:closing-summary-deploy marker — flagged", () => {
    const tmp = makePhase4Fixture();
    const skillPath = join(
      tmp,
      "plugins/zama-skills/skills/deploy/SKILL.md",
    );
    const original = readFileSync(skillPath, "utf8");
    const mutated = original.replace(
      /<!--\s*@sync:prompt:closing-summary-deploy\s*-->/g,
      "<!-- closing-summary marker stripped for test -->",
    );
    writeFileSync(skillPath, mutated, "utf8");
    const res = auditPhase4Skills(tmp);
    expect(res.ok).toBe(false);
    expect(
      res.errors.some(
        (e) =>
          e.includes("deploy") && e.includes("closing-summary-deploy"),
      ),
    ).toBe(true);
  });
});

// Silence unused-import lint when `dirname`/`mkdirSync` aren't referenced; both
// are kept available for future audit fixtures (writing brand-new tpl files).
void dirname;
void mkdirSync;
