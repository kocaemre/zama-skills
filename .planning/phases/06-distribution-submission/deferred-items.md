## 06-02 deferred

- `scripts/validate.test.ts` — 2 subprocess tests fail with `proc.status === null`
  because `validate.test.ts` hardcodes `REPO_ROOT/node_modules/.bin/tsx`, but in
  the worktree `node_modules` is shared with the parent repo (no `.bin/tsx` at
  the worktree root). Pre-existing failure unrelated to DIST-02. Fix: have the
  test resolve `tsx` via `require.resolve` or fall back to the parent repo's bin.
