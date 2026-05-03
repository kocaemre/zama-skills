/**
 * zama-init-smoke.test.ts — heavy end-to-end smoke for `/zama-init`.
 *
 * Plan 03-06. Gated by `ZAMA_INIT_SMOKE=1` so default `pnpm test` stays
 * fast (<10s). Run via `pnpm test:smoke` before submission to verify the
 * INIT-06 acceptance gate (clean dir → pnpm install → pnpm hardhat compile
 * green, no deprecation hits).
 *
 * Cost: ~3-5 min on cold cache (full pnpm install + Hardhat solc compile).
 * Required-pass before Phase 6 release-checklist sign-off.
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const SMOKE = process.env.ZAMA_INIT_SMOKE === "1";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const SCAFFOLD_SCRIPT = resolve(
  REPO_ROOT,
  "plugins",
  "zama-skills",
  "skills",
  "init",
  "scripts",
  "scaffold.ts",
);

describe.skipIf(!SMOKE)("zama-init smoke (ZAMA_INIT_SMOKE=1)", () => {
  it(
    "scaffolds confidential-token, pnpm-installs, and hardhat-compiles green",
    () => {
      const target = mkdtempSync(
        join(tmpdir(), `zama-init-smoke-${randomUUID()}-`),
      );
      // mkdtempSync creates the dir; scaffold needs it empty (it is by default).
      try {
        const res = spawnSync(
          "pnpm",
          [
            "exec",
            "tsx",
            SCAFFOLD_SCRIPT,
            "--use-case",
            "confidential-token",
            "--target",
            target,
            "--force",
          ],
          {
            cwd: REPO_ROOT,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
            env: { ...process.env },
          },
        );
        expect(res.status, `scaffold stderr:\n${res.stderr}`).toBe(0);
        // The CLI prints a JSON manifest as the LAST stdout line.
        const lastJson = (res.stdout ?? "")
          .trim()
          .split(/\r?\n/)
          .reverse()
          .find((line) => line.trim().startsWith("{"));
        expect(lastJson, "expected manifest JSON on stdout").toBeTruthy();
        const manifest = JSON.parse(lastJson as string);

        expect(manifest.useCase).toBe("confidential-token");
        const cmds: Array<{ cmd: string; ok: boolean }> = manifest.commandsRan;
        expect(cmds.some((c) => c.cmd.includes("pnpm install") && c.ok)).toBe(
          true,
        );
        expect(
          cmds.some((c) => c.cmd.includes("hardhat compile") && c.ok),
        ).toBe(true);
        expect(manifest.deprecationGrep.ok).toBe(true);
      } finally {
        if (existsSync(target)) {
          rmSync(target, { recursive: true, force: true });
        }
      }
    },
    { timeout: 600_000 },
  );
});
