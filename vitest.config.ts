import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      // Hardhat tests live in examples/** and require the hardhat runtime —
      // run them with `pnpm --filter contracts test`, not the repo-wide vitest.
      "examples/**",
      // Stale worktree copies left over from prior gsd-executor parallel runs.
      ".claude/worktrees/**",
      // .claude/ is gitignored — also excludes copies dropped by `npx zama-skills install`
      // when smoke-testing the CLI from repo root.
      ".claude/**",
      // Same reasoning for other AI-tool target dirs the CLI may write into.
      ".cursor/**",
      ".opencode/**",
      ".codex/**",
      ".aider/**",
      ".continue/**",
      "zama-skills-knowledge/**",
    ],
  },
});
