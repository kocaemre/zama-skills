---
phase: 02-shared-infrastructure
plan: 04
type: execute
wave: 3
depends_on: [02-03-build-script]
files_modified:
  - plugins/zama-skills/skills/init/SKILL.md
  - plugins/zama-skills/skills/contract/SKILL.md
  - plugins/zama-skills/skills/test/SKILL.md
  - plugins/zama-skills/skills/deploy/SKILL.md
  - plugins/zama-skills/skills/frontend/SKILL.md
  - generic/zama-init.md
  - generic/zama-contract.md
  - generic/zama-test.md
  - generic/zama-deploy.md
  - generic/zama-frontend.md
autonomous: true
requirements: [SHARED-02, SHARED-04, SHARED-05]
must_haves:
  truths:
    - "Every SKILL.md contains the canonical context7-query block via a sync marker"
    - "Every SKILL.md transcludes the deprecation-guard, anti-deprecation prompt, and decryption-paths prompt where relevant"
    - "Running `pnpm sync` produces zero diff after this plan completes (idempotent)"
    - "generic/zama-*.md files exist, mirror the SKILL.md content (post-expansion, frontmatter stripped)"
  artifacts:
    - path: "plugins/zama-skills/skills/init/SKILL.md"
      provides: "Init skill with shared markers materialized"
      contains: "@sync:shared:context7-query"
    - path: "generic/zama-init.md"
      provides: "Auto-generated generic-AI-tool variant"
      contains: "Auto-generated"
  key_links:
    - from: "plugins/zama-skills/skills/init/SKILL.md"
      to: "plugins/zama-skills/shared/context7-query.md"
      via: "sync marker (build.ts transcludes content between markers)"
      pattern: "@sync:shared:context7-query"
---

<objective>
Insert sync markers into all 5 SKILL.md files at the appropriate locations, then run `pnpm sync` (well, `tsx scripts/build.ts`) to materialize the content. Commit both the markered SKILL.md files AND the materialized output AND the generated generic/*.md files.

Purpose: Without markers in SKILL.md, the build engine has nothing to do and Phase 2 cannot prove its single-source-of-truth promise.

Output: 5 modified SKILL.md files + 5 new generic/<skill>.md files, all idempotent under repeated `tsx scripts/build.ts` runs.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-shared-infrastructure/02-CONTEXT.md
@plugins/zama-skills/skills/init/SKILL.md
@plugins/zama-skills/skills/contract/SKILL.md
@plugins/zama-skills/skills/test/SKILL.md
@plugins/zama-skills/skills/deploy/SKILL.md
@plugins/zama-skills/skills/frontend/SKILL.md
@plugins/zama-skills/shared/context7-query.md
@plugins/zama-skills/shared/snippets/deprecation-guard.md
@plugins/zama-skills/shared/snippets/sepolia-faucet.md
@plugins/zama-skills/shared/snippets/acl-tip.md
@plugins/zama-skills/shared/snippets/versions-table.md
@plugins/zama-skills/shared/prompts/anti-deprecation.md
@plugins/zama-skills/shared/prompts/decryption-paths.md
@plugins/zama-skills/shared/prompts/closing-summary.md

<interfaces>
<!-- Marker syntax (from plan 02-03) -->
- Open: `<!-- @sync:snippet:NAME -->` or `<!-- @sync:prompt:NAME -->` or `<!-- @sync:shared:NAME -->`
- Close: `<!-- @endsync -->`
- The body between markers is owned by the build engine; manual edits will be overwritten.

<!-- Resolve rules -->
- `@sync:shared:context7-query` → reads `shared/context7-query.md`
- `@sync:snippet:NAME` → reads `shared/snippets/NAME.md`
- `@sync:prompt:NAME` → reads `shared/prompts/NAME.md`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Insert sync markers into all 5 SKILL.md files</name>
  <files>
    plugins/zama-skills/skills/init/SKILL.md,
    plugins/zama-skills/skills/contract/SKILL.md,
    plugins/zama-skills/skills/test/SKILL.md,
    plugins/zama-skills/skills/deploy/SKILL.md,
    plugins/zama-skills/skills/frontend/SKILL.md
  </files>
  <action>
    Read each SKILL.md to understand its current Phase-1 skeleton structure. Insert sync markers at appropriate locations.

    Per-skill marker plan (insert empty body — `pnpm sync` will fill it):

    **All 5 skills get these baseline markers (in this order, after the YAML frontmatter, before any skill-specific content):**

    1. Context7 query reminder (top of body):
       ```markdown
       ## Documentation Authority

       <!-- @sync:shared:context7-query -->
       <!-- @endsync -->
       ```

    2. Anti-deprecation prompt:
       ```markdown
       ## Deprecation Guardrails

       <!-- @sync:prompt:anti-deprecation -->
       <!-- @endsync -->

       <!-- @sync:snippet:deprecation-guard -->
       <!-- @endsync -->
       ```

    3. Versions table reference (near install/usage section):
       ```markdown
       ## Pinned Versions

       <!-- @sync:snippet:versions-table -->
       <!-- @endsync -->
       ```

    **Skill-specific markers:**

    - **init/SKILL.md** — also include `<!-- @sync:snippet:sepolia-faucet -->` (for .env.example guidance) and `<!-- @sync:prompt:closing-summary -->` (for the post-init recap).
    - **contract/SKILL.md** — also include `<!-- @sync:snippet:acl-tip -->` and `<!-- @sync:prompt:decryption-paths -->` (CONTRACT-04 hard requirement).
    - **test/SKILL.md** — also include `<!-- @sync:snippet:acl-tip -->` (TEST-03 verification language).
    - **deploy/SKILL.md** — also include `<!-- @sync:snippet:sepolia-faucet -->` (DEPLOY-03 fetch-live-addresses reminder) and `<!-- @sync:prompt:closing-summary -->`.
    - **frontend/SKILL.md** — also include `<!-- @sync:prompt:decryption-paths -->` (FRONTEND-02 useDecrypted hook needs path awareness).

    Important: insert each marker pair exactly as shown above (open marker on its own line, close marker on its own line). Do NOT pre-fill the body — leave it empty. The build script will populate it.

    Do NOT modify the YAML frontmatter (name, description, when_to_use, allowed-tools — those are Phase 1 contracts).

    Preserve all existing skeleton content; just insert these new sections in sensible locations (typically near the top, after the skill's purpose/intro paragraph).
  </action>
  <verify>
    <automated>for f in plugins/zama-skills/skills/{init,contract,test,deploy,frontend}/SKILL.md; do grep -q "@sync:shared:context7-query" "$f" || (echo "Missing context7-query marker in $f" && exit 1); grep -q "@sync:prompt:anti-deprecation" "$f" || (echo "Missing anti-deprecation marker in $f" && exit 1); grep -q "@sync:snippet:versions-table" "$f" || (echo "Missing versions-table marker in $f" && exit 1); done && grep -q "@sync:prompt:decryption-paths" plugins/zama-skills/skills/contract/SKILL.md && grep -q "@sync:snippet:acl-tip" plugins/zama-skills/skills/contract/SKILL.md && grep -q "@sync:snippet:sepolia-faucet" plugins/zama-skills/skills/init/SKILL.md && grep -q "@sync:snippet:sepolia-faucet" plugins/zama-skills/skills/deploy/SKILL.md && echo OK</automated>
  </verify>
  <done>
    All 5 SKILL.md files contain their required marker pairs. YAML frontmatter is unchanged. Phase 1 vitest suite (frontmatter + schema validation) still passes: `pnpm test`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Run build script to materialize markers and generate generic/*.md</name>
  <files>
    plugins/zama-skills/skills/init/SKILL.md,
    plugins/zama-skills/skills/contract/SKILL.md,
    plugins/zama-skills/skills/test/SKILL.md,
    plugins/zama-skills/skills/deploy/SKILL.md,
    plugins/zama-skills/skills/frontend/SKILL.md,
    generic/zama-init.md,
    generic/zama-contract.md,
    generic/zama-test.md,
    generic/zama-deploy.md,
    generic/zama-frontend.md
  </files>
  <action>
    1. Run `tsx scripts/build.ts` (write mode) at repo root.
    2. Verify all 5 SKILL.md files now contain materialized content between their markers (no empty marker bodies).
    3. Verify `generic/zama-{init,contract,test,deploy,frontend}.md` exist and have the auto-generated header.
    4. Run `tsx scripts/build.ts --check` — must exit 0 (idempotent). If it exits 1, debug the build script to make it idempotent and re-run.
    5. Run `tsx scripts/build.ts` a second time — file mtimes may change but content must not (verify via `git status` showing no diff after the second run).
    6. Run `pnpm test` — Phase 1 frontmatter validation must still pass on the now-materialized SKILL.md files.

    If `pnpm test` fails because the materialized SKILL.md files exceed the 1536-char `description + when_to_use` cap, that means the markers leaked content into the frontmatter region — fix marker placement in Task 1 (markers must live BELOW the closing `---` of frontmatter). Re-run.
  </action>
  <verify>
    <automated>tsx scripts/build.ts && tsx scripts/build.ts --check && pnpm test && for f in generic/zama-{init,contract,test,deploy,frontend}.md; do test -f "$f" || (echo "Missing $f" && exit 1); grep -q "Auto-generated" "$f" || (echo "Missing auto-gen header in $f" && exit 1); done && echo OK</automated>
  </verify>
  <done>
    `tsx scripts/build.ts --check` exits 0 (idempotent). All 5 generic/*.md exist. All 5 SKILL.md files have non-empty bodies between every marker pair. Phase 1 vitest suite still green.
  </done>
</task>

</tasks>

<verification>
1. `tsx scripts/build.ts --check` exits 0 (no drift).
2. `pnpm test` passes (frontmatter validation green).
3. `pnpm typecheck` zero errors.
4. All 5 generic/*.md files committed and contain auto-generated header.
5. Bumping a version in pinned-versions.json (manually edit, then `tsx scripts/build.ts`) propagates to versions-table sections in all 5 SKILL.md files (smoke test — revert after).
</verification>

<success_criteria>
- 5 SKILL.md files have working markers populated by the build engine.
- 5 generic/*.md files generated.
- Build is idempotent: running it twice produces no diff.
- Single-source-of-truth promise demonstrable: a versions.json edit → propagates to all 5 SKILL.md after `tsx scripts/build.ts`.
</success_criteria>

<output>
Create `.planning/phases/02-shared-infrastructure/02-04-SUMMARY.md` listing the per-skill marker placements (so Phase 3/4 plans know where existing markers are) and any frontmatter cap concerns observed.
</output>
</content>
</invoke>