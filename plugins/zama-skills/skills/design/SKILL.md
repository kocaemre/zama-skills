---
name: zama-design
description: Turn a free-form confidential dApp idea into a production-ready blueprint. The user describes their use-case in natural language ("sealed-bid auction for art", "private DAO voting", "anonymous payroll") and this skill produces two grounded design docs — DESIGN.md (contract architecture, state schema, ACL strategy per actor, decryption path per data type, deployment notes) and UI-WIREFRAME.md (component tree, user flows, 4-state UX hooks). Every recommendation is grounded in live context7 queries against /zama-ai/fhevm and /websites/openzeppelin_confidential-contracts so no hallucinated APIs or deprecated packages leak into the design. Stops at design — does NOT scaffold or deploy.
when_to_use: Trigger phrases include "design my fhevm app", "blueprint zama dapp", "anlat fikrini", "plan confidential dapp", "what contract for X", "how should I structure", "wireframe zama", "decide architecture", "OZ base or custom". Run BEFORE /zama-init when the user has a fuzzy idea and needs concrete guidance on which OZ confidential primitive to use, what gets encrypted, who can decrypt what, and what the UI flow looks like. Outputs land in .planning/v1-design/ so the next skill (/zama-init, /zama-contract) can consume them.
allowed-tools: Bash(mkdir *) Bash(ls *) Bash(cat *) AskUserQuestion Read Write Edit
---


## MCP Prerequisites

<!-- @sync:prompt:mcp-prerequisite -->
# Required & recommended MCP servers

This skill talks to two MCP servers. The first is **required**; the second is **recommended** for higher-quality UI output.

| MCP | Status | Why | Install |
|-----|--------|-----|---------|
| `context7` | **REQUIRED** | Live Zama / OpenZeppelin Confidential / fhEVM docs (anti-hallucination guarantee) | `claude mcp add context7 -- npx -y @upstash/context7-mcp` |
| `magic` (21st.dev) | **RECOMMENDED** for `/zama-frontend` and `/zama-design` | Production-grade UI component scaffolding (shadcn-flavored, design-system-aware) | `claude mcp add magic -- npx -y @21st-dev/magic` (sign-in required) |

## Detection (mandatory — run BEFORE code generation)

Before invoking any `mcp__context7__*` or `mcp__magic__*` tool, verify the tool is available. If a `context7` call would fail (tool not found / not in the available tool list):

1. **STOP**. Do NOT generate any code or write any file.
2. Tell the user (verbatim, do not paraphrase):

   ```
   This skill requires the context7 MCP server to fetch live Zama documentation.
   It does not appear to be installed.

   Install it (one-time setup):

       claude mcp add context7 -- npx -y @upstash/context7-mcp

   After install, restart Claude Code (or run /mcp to verify) and re-run this skill.
   ```

3. Wait for the user to confirm install. Re-attempt the call. If it still fails, tell the user to run `/zama-doctor` for a full diagnostic.

If a `magic` call would fail (only relevant for `/zama-frontend` and `/zama-design` UI generation):

1. Do NOT stop — magic is optional. Continue with hand-authored shadcn components.
2. Tell the user (once, near the start of UI generation):

   ```
   Magic MCP (21st.dev) is not installed. UI components will be hand-authored
   using shadcn primitives. For higher-quality, design-system-aware components,
   install Magic:

       claude mcp add magic -- npx -y @21st-dev/magic

   Then restart Claude Code and re-run this skill.
   ```

3. Continue without magic.

## No fallback for context7

context7 is hard-required. Every Zama / OpenZeppelin / fhEVM API the skill emits is verified against `/zama-ai/fhevm` (1772 HIGH-reputation snippets) and `/websites/openzeppelin_confidential-contracts` (354 snippets). A WebFetch fallback would weaken the anti-hallucination guarantee — if context7 is unavailable, the right answer is to fix the setup, not to silently degrade.

## When in doubt

Run `/zama-doctor` — it lists every required and recommended MCP/tool with install commands and a status check.
<!-- @endsync -->

## Documentation Authority

<!-- @sync:shared:context7-query -->
# Context7 Query Block (canonical)

> **Single source of truth.** Every SKILL.md in this plugin transcludes this block via a `@sync:shared:context7-query` marker pair. Edit here, run `pnpm sync`, and all skills update.

## Why this exists

Zama Protocol package surfaces (`@fhevm/solidity`, `@zama-fhe/relayer-sdk`, `@fhevm/hardhat-plugin`, `@openzeppelin/confidential-contracts`) evolve faster than any LLM training cut-off. To avoid hallucinated APIs, **always query context7 for live documentation before emitting Zama-related code**.

## Required invocation order

When this skill activates, BEFORE generating any Solidity, TypeScript, or config file that touches fhEVM, perform the following calls in order:

1. **Resolve the primary fhEVM library**
   - Tool: `mcp__context7__resolve-library-id`
   - Argument: `libraryName: "fhevm"` → expect `/zama-ai/fhevm` (HIGH reputation, ~1772 snippets).

2. **Fetch topic-scoped fhEVM docs** for the operation in progress
   - Tool: `mcp__context7__get-library-docs`
   - `context7CompatibleLibraryId: "/zama-ai/fhevm"`
   - `topic:` narrowed to the user's question (e.g., `"acl"`, `"decryption"`, `"euint"`, `"relayer"`, `"auction"`).

3. **Fetch hardhat-template scaffolding docs** when generating build/test infra
   - `context7CompatibleLibraryId: "/zama-ai/fhevm-hardhat-template"`
   - `topic:` such as `"deploy"`, `"test"`, `"mock"`.

4. **Fetch OpenZeppelin Confidential Contracts** when generating tokens, governance, or vesting
   - `context7CompatibleLibraryId: "/websites/openzeppelin_confidential-contracts"`
   - `topic:` such as `"ERC7984"`, `"VotesConfidential"`, `"FHESafeMath"`.

5. **Fallback narrowing** — if returned docs are too broad, re-call `get-library-docs` with a tighter `topic:` parameter focused on the user's exact question.

## Hard rules

- **Never emit code that imports `fhevmjs` or `fhevm` (root package).** Both were officially deprecated 2025-07-10. Replacements are `@zama-fhe/relayer-sdk` and `@fhevm/solidity` respectively.
- **If returned context7 docs conflict with this plugin's `pinned-versions.json`, the JSON wins.** That file was npm-registry-verified on 2026-05-03 and reflects peer-dep alignment across the Zama stack. Treat docs as API guidance; treat the JSON as version truth.
- **Sepolia contract addresses are NEVER pinned in skill source.** Fetch live from `https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia` at skill runtime.

## Sources cited (HIGH reputation)

| Library ID | Snippets | Use For |
|------------|----------|---------|
| `/zama-ai/fhevm` | 1772 | Solidity FHE primitives, ACL, decryption, encrypted types |
| `/zama-ai/fhevm-hardhat-template` | 43 | Hardhat config, deploy scripts, mock testing |
| `/websites/openzeppelin_confidential-contracts` | 354 | ERC-7984, governance, FHESafeMath |
<!-- @endsync -->

# /zama-design — Workflow

This skill takes a free-form idea ("anlat fikrini") and turns it into two grounded blueprint files at `.planning/v1-design/<slug>/` under the user's current working directory:

- `DESIGN.md` — contract architecture decision (which OZ Confidential base or custom), encrypted state schema, ACL grant strategy per actor, decryption path per data type, deployment notes, recommended next skill.
- `UI-WIREFRAME.md` — component tree (Hero / Connect / 3–5 feature components), end-to-end user flows, screen states using the **4-state UX hook** (idle, encrypting, pending, decrypted), and an integration note for `@zama-fhe/relayer-sdk`.

The skill is **exploratory**, not generative — it stops at the markdown blueprints. Hand the output to `/zama-init` and `/zama-contract` for code generation.

## Step 1 — Elicit the idea (AskUserQuestion)

Use `AskUserQuestion` with three single-select questions. Each option ships a one-line "what this means" so the user picks without docs lookup.

1. **"What category fits your idea best?"**
   - `confidential-token` — value transfer with hidden balances/amounts (ERC-7984).
   - `voting` — confidential ballots, public tally (VotesConfidential).
   - `auction` — sealed-bid, encrypted-comparison winner selection (custom euint64 + FHE.le).
   - `payroll` — recurring confidential transfers between known parties (ERC-7984 + scheduling).
   - `prediction-market` — encrypted positions, oracle-driven settlement (custom + requestDecryption).
   - `custom` — none of the above; design from primitives.

2. **"What is confidential — i.e., MUST stay encrypted on-chain?"**
   - `amounts` — balance / bid / vote weight values.
   - `identities` — who participated (encrypted address mapping).
   - `outcome-until-reveal` — result is encrypted during the active phase, public after a trigger.
   - `metadata` — auxiliary data (preferences, rankings, choices) but addresses are public.

3. **"Who decrypts what?"**
   - `each-user-sees-own` — user-side decryption via `FHE.allow(handle, msg.sender)`.
   - `public-after-trigger` — public decryption via `FHE.makePubliclyDecryptable(handle)` (e.g., final tally).
   - `oracle-callback` — off-chain relayer posts plaintext via `FHE.requestDecryption` (e.g., settlement).
   - `mixed` — combination; the skill will document each data slot's path separately.

Capture answers as `<category>`, `<confidential>`, `<decryption>`. Then ask for a free-form `<one_liner>` describing the dApp ("private payroll for a 50-person remote team") and a kebab-case `<slug>` ("private-payroll").

## Step 2 — Ground decisions in context7 (live)

BEFORE writing any blueprint:

1. Run the **Documentation Authority** invocation order above.
2. Always fetch `/zama-ai/fhevm` with `topic:` set to `<category>` (`auction`, `voting`, `token`, etc.).
3. If `<category>` ∈ {`confidential-token`, `voting`, `payroll`}, ALSO fetch `/websites/openzeppelin_confidential-contracts` with `topic:` set to the relevant primitive (`ERC7984`, `VotesConfidential`).
4. If `<decryption>` ∈ {`oracle-callback`, `mixed`}, fetch `/zama-ai/fhevm` with `topic: "decryption"`.
5. If context7 is unreachable, FALL BACK to the static patterns in `${CLAUDE_SKILL_DIR}/assets/templates/` and add a banner to `DESIGN.md` saying **"⚠ context7 unreachable at design time — verify ACL / decryption snippets against /zama-ai/fhevm before /zama-init."** Never abort the skill for context7 outages — design is downstream-cheap to fix.

## Step 3 — Generate blueprint

Run `${CLAUDE_SKILL_DIR}/scripts/generate.ts` via Bash with a JSON payload describing the answers:

```bash
cd <user-cwd>
node --experimental-strip-types ${CLAUDE_SKILL_DIR}/scripts/generate.ts --inputs '{"slug":"<slug>","category":"<category>","confidential":"<confidential>","decryption":"<decryption>","oneLiner":"<one_liner>"}'
```

(`--experimental-strip-types` is the Node ≥22 flag for `.ts` execution; if unavailable, the user can run `pnpm tsx ${CLAUDE_SKILL_DIR}/scripts/generate.ts ...` instead.)

The generator:

- Creates `.planning/v1-design/<slug>/` (refuses to overwrite without `--force`).
- Writes `DESIGN.md` from `assets/templates/DESIGN.md.tpl`, substituting the answers and embedding the recommended OZ base / custom-primitive choice + ACL / decryption table.
- Writes `UI-WIREFRAME.md` from `assets/templates/UI-WIREFRAME.md.tpl`, substituting the component tree and user flow per `<category>`.
- Returns a JSON manifest on stdout describing the files written.

## Step 4 — Closing summary

Print a summary that:

- Lists the two files created with absolute paths.
- States the chosen base contract + decryption path verbatim.
- Calls out the next skill: **`/zama-init` (use the category answer to pick the same use-case option, then open the generated `DESIGN.md` alongside)**. Note that `/zama-init --from-design <path>` is the planned future flag — until it lands, the user manually picks the matching use-case in `/zama-init`'s prompt and references `DESIGN.md` for state-schema / ACL choices.
- Includes the verification line: **"Every recommendation in DESIGN.md was grounded against context7 /zama-ai/fhevm at design time — no hallucinated APIs."**

## Boundary contract

- This skill **designs**. It does NOT scaffold, deploy, or write any Solidity / TypeScript runtime code.
- Output lives ONLY under `.planning/v1-design/<slug>/`. The skill never edits files outside that directory.
- The skill never modifies `package.json`, never runs `pnpm install`, never modifies git config.

## Hard rules

- Never recommend `fhevmjs` or root-pkg `fhevm` in DESIGN.md. Both are deprecated 2025-07-10. Cross-reference the **Documentation Authority** block.
- Never pin Sepolia contract addresses in DESIGN.md. Reference the live registry URL only.
- Never emit a design that contradicts the **4-state UX hook** in UI-WIREFRAME.md (idle / encrypting / pending / decrypted) — every confidential interaction has these four observable states for the end user, and the wireframe must surface them.

<!-- @sync:prompt:closing-summary-design -->
<!-- closing-summary-design.md
     Rendered after /zama-design finishes. Substituted via
     `renderClosingSummary('design', vars)` from skills/_lib/closing-summary.ts
     and transcluded into SKILL.md via `@sync:prompt:closing-summary-design`.
     Placeholder syntax: {{key}}. -->

## ✅ /zama-design complete — `{{useCase}}` blueprint

### What was generated

- **DESIGN.md:** `{{designPath}}` — contract architecture, state schema, ACL strategy per actor, decryption path per data type
- **UI-WIREFRAME.md:** `{{wireframePath}}` — component tree, user flows, 4-state UX hooks per screen
- **Reference patterns:** queried via context7 against `/zama-ai/fhevm` + `/websites/openzeppelin_confidential-contracts`

### Why this is grounded

The blueprint cites only OpenZeppelin Confidential Contracts primitives that exist in `@openzeppelin/confidential-contracts@^0.4.x`, ACL patterns documented in `@fhevm/solidity@^0.11.x`, and SDK calls present in `@zama-fhe/relayer-sdk@^0.4.x`. Use-case-specific decisions (e.g. ERC7984 vs custom euint storage) are justified inline.

### Next: run `/zama-init` in an empty dir, then `/zama-contract` referencing `DESIGN.md` for state schema + ACL plan.
<!-- @endsync -->
