/**
 * closing-summary.test.ts — render-pure-function tests for
 * `renderClosingSummary` and `coerceManifest`.
 *
 * Plan 03-06. Uses the real shared/ tree shipped under
 * plugins/zama-skills/shared so the tests assert against the actual
 * snippets the runtime will read. Avoids stubbing those files.
 */

import { describe, it, expect } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  renderClosingSummary,
  coerceManifest,
  type ScaffoldManifest,
} from "./closing-summary.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHARED_DIR = resolve(HERE, "..", "..", "..", "shared");

function manifestWithFiles(files: string[]): ScaffoldManifest {
  return {
    filesWritten: files,
    commandsRan: [
      { cmd: "pnpm install", ok: true, durationMs: 1200 },
      { cmd: "pnpm hardhat compile", ok: true, durationMs: 3400 },
    ],
  };
}

describe("renderClosingSummary", () => {
  it("renders MetaMask deep-link tail line verbatim", () => {
    const out = renderClosingSummary(manifestWithFiles(["package.json"]), {
      useCase: "confidential-token",
      sharedDir: SHARED_DIR,
    });
    expect(out).toContain(
      "Add Sepolia to MetaMask: https://chainid.network/?search=sepolia",
    );
  });

  it("renders the context7 reassurance tail line", () => {
    const out = renderClosingSummary(manifestWithFiles(["package.json"]), {
      useCase: "confidential-token",
      sharedDir: SHARED_DIR,
    });
    expect(out).toContain("context7 was queried at scaffold time");
  });

  it("substitutes {{SKILL_NAME}} (default = /zama-init)", () => {
    const out = renderClosingSummary(manifestWithFiles(["package.json"]), {
      useCase: "confidential-token",
      sharedDir: SHARED_DIR,
    });
    expect(out).toContain("/zama-init complete");
    expect(out).not.toContain("{{SKILL_NAME}}");
  });

  it("honours an explicit skillName override", () => {
    const out = renderClosingSummary(manifestWithFiles(["package.json"]), {
      useCase: "confidential-token",
      sharedDir: SHARED_DIR,
      skillName: "/zama-other",
    });
    expect(out).toContain("/zama-other complete");
  });

  it("substitutes {{NEXT_SKILL}} → /zama-contract for confidential-token", () => {
    const out = renderClosingSummary(manifestWithFiles(["package.json"]), {
      useCase: "confidential-token",
      sharedDir: SHARED_DIR,
    });
    expect(out).toContain("/zama-contract");
    expect(out).toContain("Token.sol");
  });

  it("uses a different NEXT_SKILL_REASON for voting vs auction", () => {
    const tokenOut = renderClosingSummary(
      manifestWithFiles(["package.json"]),
      { useCase: "confidential-token", sharedDir: SHARED_DIR },
    );
    const votingOut = renderClosingSummary(
      manifestWithFiles(["package.json"]),
      { useCase: "voting", sharedDir: SHARED_DIR },
    );
    const auctionOut = renderClosingSummary(
      manifestWithFiles(["package.json"]),
      { useCase: "auction", sharedDir: SHARED_DIR },
    );
    expect(tokenOut).not.toBe(votingOut);
    expect(votingOut).toContain("VotesConfidential");
    expect(auctionOut).toContain("sealed-bid");
  });

  it("groups installed files by top-level directory in bullets", () => {
    const files = [
      "package.json",
      "packages/contracts/package.json",
      "packages/contracts/contracts/Token.sol",
      "packages/frontend/index.html",
    ];
    const out = renderClosingSummary(manifestWithFiles(files), {
      useCase: "confidential-token",
      sharedDir: SHARED_DIR,
    });
    expect(out).toContain("**packages/contracts/**");
    expect(out).toContain("**packages/frontend/**");
    // root file rendered under "(root)" group
    expect(out).toContain("**(root)**");
    // the bullet item label has the file's relative-to-group path
    expect(out).toContain("- package.json");
  });

  it("caps the file list at the configured cap and shows '(+N more)'", () => {
    const files = Array.from({ length: 50 }, (_, i) => `src/file-${i}.ts`);
    const out = renderClosingSummary(manifestWithFiles(files), {
      useCase: "confidential-token",
      sharedDir: SHARED_DIR,
      filesCap: 30,
    });
    expect(out).toMatch(/\(\+20 more\)/);
  });

  it("renders the 'Commands that already passed' tail with backticked cmd entries", () => {
    const out = renderClosingSummary(manifestWithFiles(["package.json"]), {
      useCase: "confidential-token",
      sharedDir: SHARED_DIR,
    });
    expect(out).toContain("### Commands that already passed");
    expect(out).toContain("`pnpm install`");
    expect(out).toContain("`pnpm hardhat compile`");
  });

  it("emits '(no files written)' when filesWritten is empty", () => {
    const out = renderClosingSummary(
      { filesWritten: [], commandsRan: [] },
      { useCase: "custom", sharedDir: SHARED_DIR },
    );
    expect(out).toContain("(no files written)");
  });
});

describe("coerceManifest", () => {
  it("normalizes canonical FileWritten[] form to plain string[]", () => {
    const coerced = coerceManifest({
      useCase: "confidential-token",
      targetDir: "/tmp/x",
      filesWritten: [
        { path: "package.json", bytes: 100 },
        { path: "packages/contracts/contracts/Token.sol", bytes: 2400 },
      ],
      pinsResolved: {},
      commandsRan: [
        { cmd: "pnpm install", cwd: "/tmp/x", ok: true, durationMs: 1 },
      ],
      deprecationGrep: { ok: true },
    });
    expect(coerced.filesWritten).toEqual([
      "package.json",
      "packages/contracts/contracts/Token.sol",
    ]);
    expect(coerced.commandsRan[0]?.cmd).toBe("pnpm install");
    expect(coerced.scaffoldDir).toBe("/tmp/x");
  });

  it("passes through legacy filesWritten: string[] form unchanged", () => {
    const coerced = coerceManifest({
      filesWritten: ["a", "b"],
      commandsRan: [{ cmd: "x", ok: true }],
    });
    expect(coerced.filesWritten).toEqual(["a", "b"]);
  });
});
