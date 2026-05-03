---
phase: 03-zama-init-end-to-end
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - plugins/zama-skills/skills/init/SKILL.md
autonomous: true
requirements: [INIT-01, INIT-04, INIT-05]
must_haves:
  truths:
    - "When /zama-init is invoked, Claude follows a deterministic flow: pre-flight → ask use-case → scaffold → install → compile → closing summary"
    - "SKILL.md body references runtime helpers via ${CLAUDE_SKILL_DIR}/scripts/* (preflight.ts, scaffold.ts, closing-summary.ts)"
    - "SKILL.md body lists 4 use-cases with one-line value props (token / voting / auction / custom)"
    - "Skill explicitly does NOT auto-deploy — boundary documented (defers to /zama-deploy in Phase 4)"
  artifacts:
    - path: "plugins/zama-skills/skills/init/SKILL.md"
      provides: "Headline skill body with full conversational flow"
      contains: "AskUserQuestion"
  key_links:
    - from: "plugins/zama-skills/skills/init/SKILL.md"
      to: "plugins/zama-skills/skills/init/scripts/scaffold.ts"
      via: "${CLAUDE_SKILL_DIR}/scripts/scaffold.ts"
      pattern: "CLAUDE_SKILL_DIR.*scaffold"
    - from: "plugins/zama-skills/skills/init/SKILL.md"
      to: "shared/snippets + shared/prompts"
      via: "@sync markers (already materialized in Phase 2)"
      pattern: "@sync:(snippet|prompt|shared):"
---

<objective>
Author the body of `plugins/zama-skills/skills/init/SKILL.md` — the headline skill that orchestrates the entire `/zama-init` flow. This plan ONLY edits SKILL.md; it does NOT create assets, scripts, or templates (those are 03-02..05).

Purpose: A user typing `/zama-init` in Claude Code triggers a deterministic conversation that ends with a compile-green confidential dApp. SKILL.md is Claude's runtime instruction set.
Output: SKILL.md with the existing Phase 2 sync markers preserved and a new "Workflow" body section appended below the marker blocks.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/phases/03-zama-init-end-to-end/03-CONTEXT.md
@.planning/phases/03-zama-init-end-to-end/ORCHESTRATION.md
@plugins/zama-skills/skills/init/SKILL.md
@plugins/zama-skills/shared/prompts/closing-summary.md

<interfaces>
- `${CLAUDE_SKILL_DIR}` substitution resolves to the install path of this skill (Anthropic SKILL.md spec).
- Sync markers already present (Phase 2 outputs):
  - `@sync:shared:context7-query`
  - `@sync:prompt:anti-deprecation`
  - `@sync:snippet:deprecation-guard`
  - `@sync:snippet:versions-table`
  - `@sync:snippet:sepolia-faucet`
  - `@sync:prompt:closing-summary`
- These MUST be preserved verbatim. Only the body below the markers is authored here.
- Tool used for use-case selection: `AskUserQuestion` (single-select).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace skeleton TODO with full workflow body</name>
  <files>plugins/zama-skills/skills/init/SKILL.md</files>
  <action>
Replace the trailing `# /zama-skills:init — Skeleton (Phase 1)` block (line ~239 onward) with a full workflow section. PRESERVE all `@sync:*` blocks above it verbatim — only edit content below the closing `<!-- @endsync -->` of the closing-summary marker.

Authored sections (in order):

1. **# /zama-init — Workflow**
   One-paragraph mission statement: scaffold a confidential dApp, pinned versions, deprecation-free, ends compile-green.

2. **## Step 1 — Pre-flight checks**
   Instruct Claude to run `${CLAUDE_SKILL_DIR}/scripts/preflight.ts` via Bash. On failure, print actionable error and STOP. Do NOT proceed.

3. **## Step 2 — Ask the use-case**
   Use the `AskUserQuestion` tool with a single-select of 4 options. Each option has a 1-line "what you'll get":
   - `confidential-token` — minimal `ERC7984ERC20Wrapper` mint/transfer demo
   - `voting` — `VotesConfidential` poll with confidential ballots
   - `auction` — sealed-bid auction over `euint64` (no OZ primitive)
   - `custom` — empty skeleton with FHE imports + ACL reminders
   Store the answer as `<use-case>` for downstream substitution.

4. **## Step 3 — Scaffold**
   Run `${CLAUDE_SKILL_DIR}/scripts/scaffold.ts --use-case <use-case> --target ./<use-case>-dapp` via Bash. The script:
   - materializes `assets/templates/**` into the target dir (resolving `@pin:<pkg>` placeholders from `shared/pinned-versions.json`),
   - copies `assets/seeds/<use-case>/*.sol` into `packages/contracts/contracts/`,
   - emits `.env.example`, `README.md`, `.gitignore`,
   - returns a JSON manifest on stdout for the closing summary.
   On non-zero exit, summarize the error and STOP.

5. **## Step 4 — Install + compile**
   `cd <use-case>-dapp && pnpm install` — show progress; on failure, suggest `pnpm install --frozen-lockfile=false` once and STOP if still failing.
   Then `pnpm hardhat compile`. On compile failure, suggest `pnpm hardhat clean && pnpm hardhat compile` once. On second failure, query context7 `/zama-ai/fhevm` with the Solidity error message and present findings; do NOT auto-iterate further.

6. **## Step 5 — Deprecation belt-and-suspenders grep**
   Run `${CLAUDE_SKILL_DIR}/scripts/scaffold.ts --post-grep ./<use-case>-dapp` (same script, different mode) to recursively scan for `fhevmjs` or `"fhevm":` matches. On any hit: ABORT with explicit error citing the offending file + line. This must never fire if templates are correct — it's a guardrail.

7. **## Step 6 — Closing summary**
   Invoke `${CLAUDE_SKILL_DIR}/scripts/closing-summary.ts --manifest <stdout-from-step-3> --use-case <use-case>`. Render the markdown block exactly as the script returns it. The closing summary MUST include:
   - file inventory grouped by directory
   - commands that already passed (`pnpm install`, `pnpm hardhat compile`)
   - **MetaMask Sepolia deep-link**: `https://chainid.network/?search=sepolia` (clickable)
   - 3 faucet URLs (from `@sync:snippet:sepolia-faucet` content)
   - **Next-3-actions**: `/zama-contract`, `/zama-test`, `/zama-deploy --sepolia` with one-liner each
   - Explicit "I did NOT deploy" line (per closing-summary.md template)
   - Line: "context7 was queried at scaffold time — every dependency pin is verified live, no hallucinated APIs"

8. **## Boundary contract**
   Plain-English fence:
   - This skill scaffolds. It does NOT deploy. Deploy lives in `/zama-deploy` and is gated by `disable-model-invocation: true` (Phase 4).
   - This skill writes to `./<use-case>-dapp/` only. It must refuse to overwrite a non-empty target dir without explicit user confirmation.

9. **## Hard rules** (4 bullets)
   - Never emit deprecated package names (cross-ref to deprecation-guard snippet above).
   - Never hardcode Sepolia contract addresses (cross-ref sepolia-faucet snippet).
   - Pinned versions come from `shared/pinned-versions.json` only — never from context7 doc snippets.
   - On any pre-flight or post-grep failure: STOP. Do not "best-effort" continue.

Use markdown headings consistently (`##` for steps, `###` for sub-points). No code fences for tool names — use backticks inline. Each step ≤ ~8 sentences.
  </action>
  <verify>
    <automated>
      grep -c "@sync:" plugins/zama-skills/skills/init/SKILL.md | { read n; [ "$n" -ge 6 ] || { echo "missing sync markers"; exit 1; }; } && \
      grep -q "AskUserQuestion" plugins/zama-skills/skills/init/SKILL.md && \
      grep -q "CLAUDE_SKILL_DIR.*scaffold" plugins/zama-skills/skills/init/SKILL.md && \
      grep -q "CLAUDE_SKILL_DIR.*preflight" plugins/zama-skills/skills/init/SKILL.md && \
      grep -q "CLAUDE_SKILL_DIR.*closing-summary" plugins/zama-skills/skills/init/SKILL.md && \
      grep -q "chainid.network" plugins/zama-skills/skills/init/SKILL.md && \
      grep -q "disable-model-invocation" plugins/zama-skills/skills/init/SKILL.md && \
      grep -q "Boundary contract" plugins/zama-skills/skills/init/SKILL.md && \
      ! grep -q "TODO: Phase 3" plugins/zama-skills/skills/init/SKILL.md && \
      pnpm validate
    </automated>
  </verify>
  <done>
    SKILL.md body authored end-to-end; all 6 sync markers preserved; `pnpm validate` green; skeleton TODO removed.
  </done>
</task>

</tasks>

<verification>
- All 6 Phase 2 sync marker blocks intact and untouched.
- 6-step workflow present: pre-flight → ask → scaffold → install/compile → deprecation grep → closing summary.
- Boundary contract section explicitly states "does NOT deploy".
- `${CLAUDE_SKILL_DIR}/scripts/{preflight,scaffold,closing-summary}.ts` referenced (these files are created in 03-04 and 03-05; 03-01 only references them).
- `pnpm validate` green (Phase 2 drift contract still satisfied).
</verification>

<success_criteria>
- INIT-01 (use-case branching) — Step 2 satisfies via AskUserQuestion.
- INIT-04 (MetaMask deep-link) — Step 6 closing summary explicit.
- INIT-05 (closing summary) — Step 6 explicit; references closing-summary.ts.
- INIT-06 (compile-green guarantee) — Step 4 explicit; failure modes defined.
- Skill body is deterministic — different Claude sessions produce equivalent flow.
</success_criteria>

<output>
After completion, create `.planning/phases/03-zama-init-end-to-end/03-01-SUMMARY.md` with the materialized SKILL.md path, line counts, and the 6 referenced runtime helpers (3 in scripts/, 3 sync block names already present).
</output>
