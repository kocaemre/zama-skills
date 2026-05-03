/**
 * scaffold.test.ts — filesystem-level tests for `scaffold()` and `postGrep()`.
 *
 * Plan 03-06. Uses real `fs` + `os.tmpdir()` (no mocks — too brittle for
 * recursive copy + outputFile chains). Each test owns a unique tmp dir
 * and cleans it up in afterEach.
 *
 * Skips `pnpm install` and `pnpm hardhat compile` via `--no-install` /
 * `--no-compile` (i.e. `install: false, compile: false`) so this file
 * stays under a few seconds. The expensive end-to-end path is gated
 * behind ZAMA_INIT_SMOKE in tests/integration/zama-init-smoke.test.ts.
 */

import { afterEach, beforeEach, describe, it, expect } from "vitest";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { scaffold, postGrep, assertWithinTarget } from "./scaffold.js";

const HERE = dirname(fileURLToPath(import.meta.url));
// scripts/ → init/ → skills/ → zama-skills/ (plugin root containing shared/)
const PLUGIN_ROOT = resolve(HERE, "..", "..", "..");

function makeTmp(): string {
  return mkdtempSync(join(tmpdir(), `zama-init-test-${randomUUID()}-`));
}

describe("scaffold (no-install / no-compile)", () => {
  let target: string;

  beforeEach(() => {
    target = makeTmp();
    // makeTmp creates an existing dir — wipe it so the empty-dir guard
    // in scaffold() does not require --force in the happy path.
    rmSync(target, { recursive: true, force: true });
  });

  afterEach(() => {
    if (target && existsSync(target)) {
      rmSync(target, { recursive: true, force: true });
    }
  });

  it("scaffolds confidential-token: writes pinned package.json + seed contract + env files", async () => {
    const manifest = await scaffold({
      useCase: "confidential-token",
      targetDir: target,
      install: false,
      compile: false,
      pluginRoot: PLUGIN_ROOT,
    });

    // Root package.json
    const rootPkgPath = join(target, "package.json");
    expect(existsSync(rootPkgPath)).toBe(true);
    const rootPkg = readFileSync(rootPkgPath, "utf8");
    expect(rootPkg).toContain('"typescript": "^5.9.3"');

    // Contracts package.json — pins resolved, no @pin: markers left
    const contractsPkgPath = join(
      target,
      "packages",
      "contracts",
      "package.json",
    );
    expect(existsSync(contractsPkgPath)).toBe(true);
    const contractsPkg = readFileSync(contractsPkgPath, "utf8");
    // No unresolved `<!-- @pin:... -->` placeholders left in the materialized file.
    // (Note: harmless prose mentions of "@pin:" inside `_comment_*` keys are fine.)
    expect(contractsPkg).not.toMatch(/<!--\s*@pin:/);
    expect(contractsPkg).toContain("@fhevm/solidity");
    // resolved version came from pinned-versions.json (^0.11.1)
    expect(contractsPkg).toMatch(/"@fhevm\/solidity":\s*"\^0\.11\.1"/);

    // Seed contract copied
    const tokenSol = join(
      target,
      "packages",
      "contracts",
      "contracts",
      "Token.sol",
    );
    expect(existsSync(tokenSol)).toBe(true);

    // Dotfile templates rendered with their leading dot preserved
    const envExample = join(target, ".env.example");
    expect(existsSync(envExample)).toBe(true);
    expect(readFileSync(envExample, "utf8")).toContain("INFURA_API_KEY");

    const gitignore = join(target, ".gitignore");
    expect(existsSync(gitignore)).toBe(true);
    expect(readFileSync(gitignore, "utf8")).toContain(".env");

    // Manifest sanity
    expect(manifest.useCase).toBe("confidential-token");
    expect(manifest.filesWritten.length).toBeGreaterThan(0);
    expect(Object.keys(manifest.pinsResolved).length).toBeGreaterThan(0);
    expect(manifest.deprecationGrep.ok).toBe(true);
  });

  it("refuses to scaffold into a non-empty directory without --force", async () => {
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, "leftover.txt"), "occupied");

    await expect(
      scaffold({
        useCase: "confidential-token",
        targetDir: target,
        install: false,
        compile: false,
        pluginRoot: PLUGIN_ROOT,
      }),
    ).rejects.toThrow(/not empty/);
  });

  it("overwrites a non-empty directory when force=true", async () => {
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, "leftover.txt"), "occupied");

    const manifest = await scaffold({
      useCase: "confidential-token",
      targetDir: target,
      force: true,
      install: false,
      compile: false,
      pluginRoot: PLUGIN_ROOT,
    });
    expect(existsSync(join(target, "package.json"))).toBe(true);
    expect(manifest.deprecationGrep.ok).toBe(true);
  });
});

describe("postGrep deprecation scanner", () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTmp();
  });

  afterEach(() => {
    if (dir && existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("flags an `import 'fhevmjs'` statement in a .ts file", () => {
    writeFileSync(
      join(dir, "uses-fhevmjs.ts"),
      "import { initFhevm } from 'fhevmjs';\nexport const x = 1;\n",
    );
    const res = postGrep(dir);
    expect(res.ok).toBe(false);
    expect(res.matches.length).toBeGreaterThan(0);
    expect(res.matches[0]?.text).toContain("fhevmjs");
  });

  it("flags `\"fhevmjs\":` in a package.json dependency map", () => {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ dependencies: { fhevmjs: "^0.6.2" } }, null, 2),
    );
    const res = postGrep(dir);
    expect(res.ok).toBe(false);
    expect(res.matches.length).toBe(1);
  });

  it("returns ok=true for a clean tree", () => {
    writeFileSync(
      join(dir, "clean.ts"),
      "import { foo } from '@fhevm/solidity';\n",
    );
    const res = postGrep(dir);
    expect(res.ok).toBe(true);
    expect(res.matches).toEqual([]);
  });

  it("ignores deprecated package names appearing in comment lines", () => {
    // Skeleton.sol-style allowlist: a // comment mentioning fhevmjs should
    // not register as a hit. Source file (`.ts`) so import-style regex applies.
    writeFileSync(
      join(dir, "doc.ts"),
      "// historical note: fhevmjs is deprecated — use @zama-fhe/relayer-sdk\nexport const ok = true;\n",
    );
    const res = postGrep(dir);
    expect(res.ok).toBe(true);
  });

  it("CR-02: package.json bypass via `#`-prefixed comment-style key is NOT skipped", () => {
    // A malicious or accidental package.json with a `#`-prefixed key shape
    // (legal JSON) attempting to leak a deprecated dep MUST be flagged.
    // Pre-fix: isCommentLine would skip the line because it starts with '#'.
    writeFileSync(
      join(dir, "package.json"),
      [
        "{",
        '  "name": "evil",',
        '  "#fhevmjs": "0.6.2",',
        '  "dependencies": {}',
        "}",
      ].join("\n"),
    );
    const res = postGrep(dir);
    expect(res.ok).toBe(false);
    expect(res.matches.length).toBeGreaterThanOrEqual(1);
  });

  it("CR-02: package.json bypass via `// comment` line above a dep is NOT skipped", () => {
    // Some tooling tolerates JSON-with-comments (JSON5). Pre-fix the
    // isCommentLine guard would skip a `//` line containing the dep ref.
    writeFileSync(
      join(dir, "package.json"),
      [
        "{",
        "  // fhevmjs is the OLD package — but we are sneaking it in below:",
        '  "dependencies": { "fhevmjs": "0.6.2" }',
        "}",
      ].join("\n"),
    );
    const res = postGrep(dir);
    expect(res.ok).toBe(false);
    // Flag the dep line at minimum.
    expect(res.matches.some((m) => /fhevmjs/.test(m.text))).toBe(true);
  });

  it("CR-02: catches `bundleDependencies` array form for fhevmjs/fhevm", () => {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify(
        {
          name: "evil",
          bundleDependencies: ["fhevmjs", "lodash"],
        },
        null,
        2,
      ),
    );
    const res = postGrep(dir);
    expect(res.ok).toBe(false);
    expect(res.matches.some((m) => /fhevmjs/.test(m.text))).toBe(true);
  });

  it("skips node_modules, .git, cache, artifacts subtrees", () => {
    const nm = join(dir, "node_modules");
    mkdirSync(nm, { recursive: true });
    writeFileSync(
      join(nm, "tainted.ts"),
      "import x from 'fhevmjs';\n",
    );
    const res = postGrep(dir);
    expect(res.ok).toBe(true);
  });
});

describe("assertWithinTarget — path traversal containment (CR-01)", () => {
  it("accepts a destination that is a strict descendant of target", () => {
    const target = "/tmp/zama-target";
    expect(() =>
      assertWithinTarget(target, "/tmp/zama-target/packages/contracts/Token.sol", "test"),
    ).not.toThrow();
  });

  it("accepts the target root itself", () => {
    const target = "/tmp/zama-target";
    expect(() => assertWithinTarget(target, "/tmp/zama-target", "test")).not.toThrow();
  });

  it("rejects a destRel containing '..' segments that escapes the target", () => {
    const target = "/tmp/zama-target";
    // resolve("/tmp/zama-target", "../escape.txt") → "/tmp/escape.txt"
    const escapingDest = resolve(target, "..", "escape.txt");
    expect(() => assertWithinTarget(target, escapingDest, "evil-template")).toThrow(
      /Refusing to write outside target/,
    );
  });

  it("rejects an absolute path outside target (e.g. ~/.ssh/authorized_keys shape)", () => {
    const target = "/tmp/zama-target";
    expect(() =>
      assertWithinTarget(target, "/etc/passwd", "evil-template"),
    ).toThrow(/Refusing to write outside target/);
  });

  it("rejects a sibling directory that shares a common prefix", () => {
    // "/tmp/zama-target-evil" shares prefix "/tmp/zama-target" but is NOT
    // a descendant — the `+ sep` check guards against this exact case.
    const target = "/tmp/zama-target";
    expect(() =>
      assertWithinTarget(target, "/tmp/zama-target-evil/file.txt", "evil-template"),
    ).toThrow(/Refusing to write outside target/);
  });
});
