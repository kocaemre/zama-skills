---
phase: 02-shared-infrastructure
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - plugins/zama-skills/shared/context7-query.md
  - plugins/zama-skills/shared/snippets/versions-table.md
  - plugins/zama-skills/shared/snippets/deprecation-guard.md
  - plugins/zama-skills/shared/snippets/acl-tip.md
  - plugins/zama-skills/shared/snippets/sepolia-faucet.md
  - plugins/zama-skills/shared/prompts/anti-deprecation.md
  - plugins/zama-skills/shared/prompts/decryption-paths.md
  - plugins/zama-skills/shared/prompts/closing-summary.md
autonomous: true
requirements: [SHARED-02, SHARED-05]
must_haves:
  truths:
    - "A canonical context7-query block exists at shared/context7-query.md and is the single source transcluded by every SKILL.md"
    - "Reusable snippets (versions table, deprecation guard, ACL tip, Sepolia faucet) exist as authored markdown files"
    - "Three prompt fragments (anti-deprecation, decryption-paths, closing-summary) exist for transclusion into the 5 SKILL.md files in later phases"
  artifacts:
    - path: "plugins/zama-skills/shared/context7-query.md"
      provides: "The single context7 invocation block referenced by all 5 skills"
      min_lines: 20
    - path: "plugins/zama-skills/shared/snippets/sepolia-faucet.md"
      provides: "Sepolia faucet + RPC + relayer URLs (no contract addresses pinned)"
      contains: "docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia"
    - path: "plugins/zama-skills/shared/prompts/decryption-paths.md"
      provides: "Decision tree for public / user / oracle decryption paths"
      contains: "publicDecrypt"
  key_links:
    - from: "plugins/zama-skills/shared/snippets/versions-table.md"
      to: "plugins/zama-skills/shared/pinned-versions.json"
      via: "human-authored mirror; build script can later regenerate"
      pattern: "@fhevm/solidity"
    - from: "plugins/zama-skills/shared/prompts/anti-deprecation.md"
      to: "plugins/zama-skills/shared/deprecated-imports.json"
      via: "human-authored ban list reference"
      pattern: "fhevmjs"
---

<objective>
Author the 5 reusable snippets and 3 prompt fragments that downstream SKILL.md files will transclude. Also author the canonical context7-query.md block at the top of `shared/`.

Purpose: SKILL.md files must not duplicate prose. By centralizing these blocks here, a single edit changes all 5 skills consistently after `pnpm sync` runs.

Output: 1 top-level shared markdown (context7-query.md) + 4 snippets/ files + 3 prompts/ files = 8 markdown files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/REQUIREMENTS.md
@.planning/phases/02-shared-infrastructure/02-CONTEXT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author shared/context7-query.md and shared/snippets/*.md</name>
  <files>
    plugins/zama-skills/shared/context7-query.md,
    plugins/zama-skills/shared/snippets/versions-table.md,
    plugins/zama-skills/shared/snippets/deprecation-guard.md,
    plugins/zama-skills/shared/snippets/acl-tip.md,
    plugins/zama-skills/shared/snippets/sepolia-faucet.md
  </files>
  <action>
    Author each file. Reference content authority: CLAUDE.md (for versions, deprecations, sources). Per SHARED-02 in REQUIREMENTS.md, `context7-query.md` lives at `shared/context7-query.md` (top-level, NOT under snippets/).

    **`plugins/zama-skills/shared/context7-query.md`** — the canonical "query context7 first" block. Must instruct the agent to invoke (in order):
    - `mcp__context7__resolve-library-id` for `/zama-ai/fhevm` (HIGH reputation, 1772 snippets)
    - `mcp__context7__get-library-docs` for fhEVM patterns relevant to the current task (topic-scoped)
    - `/zama-ai/fhevm-hardhat-template` for build/test scaffolding
    - `/websites/openzeppelin_confidential-contracts` for ERC-7984 / VotesConfidential / FHESafeMath
    - Fallback: `mcp__context7__get-library-docs` with the `topic:` parameter narrowed to the user's specific question (e.g., `topic: "decryption"`)
    - State explicitly: "Never emit code that imports `fhevmjs` or `fhevm` (root) — both deprecated 2025-07-10."
    - State: "If the library docs returned conflict with this skill's pinned-versions.json, the JSON wins (it was npm-registry-verified 2026-05-03)."

    **`plugins/zama-skills/shared/snippets/versions-table.md`** — markdown table with columns: Package | Version | Notes. Mirror the entries from pinned-versions.json (every entry). Include solc 0.8.27 row and Node `>=20`. Add a header comment: `<!-- Generated from pinned-versions.json — do not edit manually; run \`pnpm sync\` to regenerate. -->`

    **`plugins/zama-skills/shared/snippets/deprecation-guard.md`** — short prose block (≤30 lines) listing the 2 deprecated packages (fhevmjs, fhevm) with replacements, plus the 2 incompatible packages (hardhat@^3, ethers@^5). Must include the explicit refusal language: "If the user asks me to import `fhevmjs` or `fhevm` (root pkg), I refuse and propose the modern replacement instead."

    **`plugins/zama-skills/shared/snippets/acl-tip.md`** — concise reminder (≤20 lines) covering: every state-write that produces an `euint*`/`ebool` handle MUST be followed by `FHE.allowThis(handle)`; if the caller needs to user-decrypt later, also `FHE.allow(handle, msg.sender)`; reference is `@fhevm/solidity@^0.11.1` ACL primitives. Cite that the ACL pattern changed in `@fhevm/solidity@0.11.x` so always check context7 `/zama-ai/fhevm` topic="acl" before generating new patterns.

    **`plugins/zama-skills/shared/snippets/sepolia-faucet.md`** — URL-only block (no contract addresses). Include:
    - Live address registry URL: `https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia` with note "Skill MUST WebFetch this at runtime; never pin in source."
    - Sepolia faucet: e.g., `https://sepoliafaucet.com/` and Alchemy faucet
    - Relayer URL placeholder hint: "Confirm current relayer URL via context7 `/zama-ai/fhevm` topic=\"relayer\" before emitting."
    - RPC provider env-var pattern: `INFURA_API_KEY` / `ALCHEMY_API_KEY`.
    - Explicit: "Never include hardcoded ACL/KMS/Coprocessor/Registry addresses in generated code."

    Each file should start with a level-1 markdown heading and be self-contained prose. None of these files contains transclusion markers — they ARE the source content others transclude.
  </action>
  <verify>
    <automated>test -f plugins/zama-skills/shared/context7-query.md && test -f plugins/zama-skills/shared/snippets/versions-table.md && test -f plugins/zama-skills/shared/snippets/deprecation-guard.md && test -f plugins/zama-skills/shared/snippets/acl-tip.md && test -f plugins/zama-skills/shared/snippets/sepolia-faucet.md && grep -q "docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia" plugins/zama-skills/shared/snippets/sepolia-faucet.md && grep -q "fhevmjs" plugins/zama-skills/shared/snippets/deprecation-guard.md && grep -q "/zama-ai/fhevm" plugins/zama-skills/shared/context7-query.md && echo OK</automated>
  </verify>
  <done>
    Five markdown files exist, all contain the required canonical references, no contract addresses are pinned in sepolia-faucet.md (verified via `grep -E '0x[a-fA-F0-9]{40}' plugins/zama-skills/shared/snippets/sepolia-faucet.md` returning empty).
  </done>
</task>

<task type="auto">
  <name>Task 2: Author shared/prompts/{anti-deprecation,decryption-paths,closing-summary}.md</name>
  <files>
    plugins/zama-skills/shared/prompts/anti-deprecation.md,
    plugins/zama-skills/shared/prompts/decryption-paths.md,
    plugins/zama-skills/shared/prompts/closing-summary.md
  </files>
  <action>
    Author each prompt fragment. These are agent-instruction prose that will be transcluded into SKILL.md files in Phases 3 and 4.

    **`plugins/zama-skills/shared/prompts/anti-deprecation.md`** — Imperative instructions to the skill-driven agent:
    - "Before emitting ANY import, check `plugins/zama-skills/shared/deprecated-imports.json`."
    - "If the package is in `deprecated`, refuse to emit it; emit the `replaces` value instead and explain why in 1 line."
    - "If the package is in `incompatible` (e.g., hardhat@^3), refuse and emit `useInstead` instead."
    - "Never offer fallback workarounds for deprecated packages — they are unsafe (no upstream support)."

    **`plugins/zama-skills/shared/prompts/decryption-paths.md`** — Decision tree covering the three Zama decryption paths:
    1. **Public decryption** (`FHE.publicDecrypt`) — value will be visible to anyone reading chain state. Use only when result is intentionally public (e.g., final auction winner, vote tally).
    2. **User decryption** (relayer-sdk client-side `userDecrypt`) — only the user with the matching key sees plaintext. Use for personal balances, private inputs.
    3. **Oracle / async decryption** (`FHE.requestDecryption` callback) — for on-chain logic that conditionally branches on plaintext (e.g., compare two encrypted values, settle a market). Has callback gas cost; relayer mediates.
    - Include guidance: "Ask the user which path applies before generating decrypt logic. Default-refuse if unspecified."
    - Cross-reference: "Confirm signature for the chosen path via context7 `/zama-ai/fhevm` topic=\"decryption\" — the API surface evolved across `@fhevm/solidity@0.10.x → 0.11.x`."

    **`plugins/zama-skills/shared/prompts/closing-summary.md`** — Skill-end reporting template the skills should print at completion:
    - "What was installed/created" (file list)
    - "Next recommended skills" (one-liner per remaining /zama-* skill in this plugin)
    - "Pinned versions table" (transcluded from `snippets/versions-table.md`)
    - "Sepolia next steps" — link to MetaMask Sepolia deep-link `https://chainid.network/?...` and faucet URLs (transcluded from `snippets/sepolia-faucet.md`)
    - "What was NOT done" — explicit list (e.g., "I did NOT deploy yet — run /zama-deploy when ready")
    - Use placeholder tokens like `{{INSTALLED_FILES}}` and `{{NEXT_SKILL}}` so the build/skill runtime can substitute. Document the placeholder list at the bottom of the file.
  </action>
  <verify>
    <automated>test -f plugins/zama-skills/shared/prompts/anti-deprecation.md && test -f plugins/zama-skills/shared/prompts/decryption-paths.md && test -f plugins/zama-skills/shared/prompts/closing-summary.md && grep -q "publicDecrypt" plugins/zama-skills/shared/prompts/decryption-paths.md && grep -q "userDecrypt" plugins/zama-skills/shared/prompts/decryption-paths.md && grep -q "requestDecryption" plugins/zama-skills/shared/prompts/decryption-paths.md && grep -q "deprecated-imports.json" plugins/zama-skills/shared/prompts/anti-deprecation.md && echo OK</automated>
  </verify>
  <done>
    Three prompt files exist; decryption-paths.md mentions all three decryption mechanisms by name; anti-deprecation.md references the deprecated-imports.json data file; closing-summary.md uses placeholder tokens documented at the bottom.
  </done>
</task>

</tasks>

<verification>
1. All 8 files exist (5 from Task 1 + 3 from Task 2).
2. `grep -REn '0x[a-fA-F0-9]{40}' plugins/zama-skills/shared/` returns NO matches (no pinned addresses).
3. `grep -RIc fhevmjs plugins/zama-skills/shared/` shows mentions only in deprecation-guard.md and anti-deprecation.md (and any reference content) — never as a recommended import.
4. Each prompt file is < 200 lines (concise enough to transclude without bloating SKILL.md).
</verification>

<success_criteria>
- 8 source markdown files authored with canonical content.
- No contract addresses, no deprecated package recommendations.
- Files are transclusion-ready: self-contained, level-1 headed, no dependencies on other markdown.
</success_criteria>

<output>
Create `.planning/phases/02-shared-infrastructure/02-02-SUMMARY.md` listing the 8 files, the placeholders introduced in closing-summary.md, and any cross-file references.
</output>
</content>
</invoke>