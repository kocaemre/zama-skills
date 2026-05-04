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
    ],
  },
});
