---
phase: 04-other-4-skills
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - plugins/zama-skills/skills/contract/SKILL.md
  - plugins/zama-skills/skills/contract/scripts/generate.ts
  - plugins/zama-skills/skills/contract/scripts/lib/acl-injector.ts
  - plugins/zama-skills/skills/contract/scripts/lib/cleartext-guard.ts
  - plugins/zama-skills/skills/contract/scripts/lib/preflight.ts
  - plugins/zama-skills/skills/contract/assets/templates/contract.sol.tpl
  - plugins/zama-skills/skills/contract/assets/templates/erc7984.sol.tpl
  - plugins/zama-skills/skills/contract/assets/templates/votes.sol.tpl
  - plugins/zama-skills/skills/contract/scripts/generate.test.ts
autonomous: true
requirements: [CONTRACT-01, CONTRACT-02, CONTRACT-03, CONTRACT-04, CONTRACT-05]
must_haves:
  truths:
    - "Running /zama-contract prompts: name → base contract → state schema → decryption path"
    - "Every generated state-write produces euint*/ebool/eaddress + FHE.allowThis(handle) immediately after"
    - "Handles exposed via return value or getter also receive FHE.allow(handle, msg.sender)"
    - "Cleartext-leak patterns (require(decrypt(...)), if (decrypt(x)), == against decrypted) are REFUSED with canonical FHE.lt/eq replacement"
    - "Every emitted contract starts with HCU budget reminder comment (20M/tx, 5M depth)"
    - "Contract written to packages/contracts/contracts/<Name>.sol — never stdout"
    - "Skill refuses to import deprecated fhevm or fhevmjs packages"
    - "ERC7984 / VotesConfidential / standalone / Ownable base options use @openzeppelin/confidential-contracts and @fhevm/solidity correctly"
  artifacts:
    - path: "plugins/zama-skills/skills/contract/SKILL.md"
      provides: "Skill body — sequential AskUserQuestion flow + ACL invariant block + cleartext-leak refusal block + HCU reminder"
      contains: "AskUserQuestion"
    - path: "plugins/zama-skills/skills/contract/scripts/generate.ts"
      provides: "Runtime orchestrator: read user inputs from skill, materialize template, run cleartext guard, write file"
      exports: ["generateContract"]
    - path: "plugins/zama-skills/skills/contract/scripts/lib/acl-injector.ts"
      provides: "Post-process emitted Solidity to inject FHE.allowThis after every euint/ebool assignment + FHE.allow on returns"
      exports: ["injectAclGrants"]
    - path: "plugins/zama-skills/skills/contract/scripts/lib/cleartext-guard.ts"
      provides: "AST/regex check that REFUSES forbidden patterns; returns canonical replacement suggestion"
      exports: ["assertNoCleartextLeak", "FORBIDDEN_PATTERNS"]
    - path: "plugins/zama-skills/skills/contract/assets/templates/contract.sol.tpl"
      provides: "Standalone contract template with HCU header + state stub + ACL invariant comment"
      contains: "HCU budget"
    - path: "plugins/zama-skills/skills/contract/assets/templates/erc7984.sol.tpl"
      provides: "ERC7984 token template extending @openzeppelin/confidential-contracts/token/ERC7984.sol"
      contains: "ERC7984"
    - path: "plugins/zama-skills/skills/contract/assets/templates/votes.sol.tpl"
      provides: "VotesConfidential governance template"
      contains: "VotesConfidential"
  key_links:
    - from: "plugins/zama-skills/skills/contract/SKILL.md"
      to: "plugins/zama-skills/skills/contract/scripts/generate.ts"
      via: "${CLAUDE_SKILL_DIR}/scripts/generate.ts"
      pattern: "CLAUDE_SKILL_DIR.*generate"
    - from: "scripts/generate.ts"
      to: "scripts/lib/cleartext-guard.ts"
      via: "assertNoCleartextLeak invocation BEFORE writing file"
      pattern: "assertNoCleartextLeak"
    - from: "scripts/generate.ts"
      to: "scripts/lib/acl-injector.ts"
      via: "injectAclGrants post-processing"
      pattern: "injectAclGrants"
---

<objective>
Author the `/zama-contract` skill end-to-end: SKILL.md body + runtime helpers + 3 Solidity templates. The skill takes user inputs (name, base contract, state schema, decryption path) and writes a complete fhEVM contract to `packages/contracts/contracts/<Name>.sol` with auto-injected ACL grants, refused cleartext-leak patterns, and HCU reminders.

Purpose: Implements all 5 CONTRACT-* requirements. The cleartext-leak hard refusal is the project's biggest defensible differentiator vs vanilla LLM codegen.
Output: Working `/zama-contract` skill that emits compile-clean ACL-safe Solidity.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/phases/04-other-4-skills/04-CONTEXT.md
@CLAUDE.md
@plugins/zama-skills/skills/contract/SKILL.md
@plugins/zama-skills/shared/snippets/acl-tip.md
@plugins/zama-skills/shared/prompts/decryption-paths.md
@plugins/zama-skills/shared/pinned-versions.json
@plugins/zama-skills/skills/init/scripts/scaffold.ts

<interfaces>
- Solidity pragma: `0.8.27` (matches template; OZ confidential supports `^0.8.24`)
- Imports we emit:
  - `import {FHE, euint8, euint16, euint32, euint64, ebool, eaddress, externalEuint64, externalEbool} from "@fhevm/solidity/lib/FHE.sol";`
  - `import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";`
  - For ERC7984 base: `import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984.sol";`
  - For Votes base: `import {VotesConfidential} from "@openzeppelin/confidential-contracts/governance/VotesConfidential.sol";`
- Imports we REFUSE (deprecated): `fhevm` (root), `fhevmjs` — must not appear anywhere
- ACL pattern (per @fhevm/solidity@0.11.x):
  - After `euint64 newBal = FHE.add(balance, amount); balance = newBal;` → emit `FHE.allowThis(balance);`
  - If function returns the handle: emit `FHE.allow(balance, msg.sender);`
- Cleartext-leak FORBIDDEN_PATTERNS (regex strings, refuse + suggest replacement):
  - `require\s*\(\s*(FHE\.)?decrypt\s*\(` → suggest `FHE.req` not available; use `FHE.allow` + off-chain decrypt
  - `if\s*\(\s*(FHE\.)?decrypt\s*\(` → suggest `ebool cond = FHE.lt/eq/...; FHE.allow(cond, recipient);`
  - `==`, `!=`, `<`, `>`, `<=`, `>=` against an identifier whose declared type starts with `euint`/`ebool` → suggest `FHE.eq/ne/lt/gt/le/ge`
  - any literal `decrypt(` call applied to an `euint*` storage slot
- HCU reminder (header comment, every contract):
  ```
  // HCU budget: 20M/tx, 5M depth.
  // Heavy loops + nested FHE.select can exceed; use `pnpm gas-report` to profile.
  ```
- Input schema (passed from SKILL.md via env or stdin JSON):
  ```ts
  type ContractInputs = {
    name: string;             // PascalCase
    base: 'standalone' | 'erc7984' | 'votes' | 'ownable';
    schema: Array<{ name: string; type: 'euint8'|'euint16'|'euint32'|'euint64'|'ebool'|'eaddress'; mapping?: 'address' | 'uint256' | null }>;
    decryptionPath: 'public' | 'user' | 'oracle';
  };
  ```
- Output path: `packages/contracts/contracts/<Name>.sol` — abort if file exists unless `--force`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author SKILL.md body</name>
  <files>plugins/zama-skills/skills/contract/SKILL.md</files>
  <action>
Replace the existing skeleton body (preserving any Phase 1/2 frontmatter + sync markers above) with the full workflow:

1. **Frontmatter additions** (if missing):
   - `allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit]` (no `disable-model-invocation` — this skill auto-invokes OK per CONTEXT.md decision)

2. **# /zama-contract — Workflow**
   One-paragraph mission: generate ACL-safe fhEVM contract with auto-injected grants and refused cleartext leaks.

3. **## Step 1 — Pre-flight**
   Bash `${CLAUDE_SKILL_DIR}/scripts/lib/preflight.ts` (workspace detect — must find `packages/contracts/`). If missing print `Run /zama-init first to scaffold the project.` and STOP.

4. **## Step 2 — Sequential AskUserQuestion (4 questions)**
   - Q1: contract name (PascalCase, validate)
   - Q2: base contract — single-select: `ERC7984 (confidential token)` / `VotesConfidential (governance)` / `Standalone` / `Ownable extension`
   - Q3: state schema — repeat-prompt for each field: name + type (`euint8|16|32|64`, `ebool`, `eaddress`) + mapping key type (none, address, uint256). Stop when user says "done".
   - Q4: decryption path — single-select: `public (anyone can decrypt)` / `user (caller only via FHE.allow)` / `oracle (off-chain relayer with allowlist)`. Each option's description includes a representative function signature.

5. **## Step 3 — Cleartext-leak invariants (DO NOT REMOVE BLOCK)**
   Embedded markdown listing the 12 forbidden patterns with canonical replacements. Reference: `${CLAUDE_SKILL_DIR}/scripts/lib/cleartext-guard.ts`.

6. **## Step 4 — ACL invariants**
   Inline rule: every state write of an encrypted handle MUST be followed by `FHE.allowThis(handle)`. Handles returned to callers MUST also have `FHE.allow(handle, msg.sender)`. Reference: `${CLAUDE_SKILL_DIR}/scripts/lib/acl-injector.ts`.

7. **## Step 5 — HCU budget reminder**
   Insert as comment header on every emitted contract. Inline reminder also inserted by `generate.ts` around any loop body or nested `FHE.select`.

8. **## Step 6 — Generate**
   Bash `${CLAUDE_SKILL_DIR}/scripts/generate.ts --inputs <json>`. Captures output path; aborts on guard failure with the canonical replacement message.

9. **## Step 7 — Closing summary**
   Print: file path written, ACL grants injected count, "This contract refuses 12 known cleartext-leak patterns", and "Next: run /zama-test to generate mock + Sepolia tests for this contract."

Preserve all existing `@sync:*` blocks verbatim.
  </action>
  <verify>
    <automated>node -e "const fs=require('fs'); const s=fs.readFileSync('plugins/zama-skills/skills/contract/SKILL.md','utf8'); for (const m of ['AskUserQuestion','FHE.allowThis','HCU budget','cleartext','/zama-test']) if (!s.includes(m)) { console.error('missing:',m); process.exit(1); }"</automated>
  </verify>
  <done>SKILL.md contains all 7 workflow steps, 4-question AskUserQuestion flow, refusal block, ACL block, HCU reminder, and "next: /zama-test" closing line.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement cleartext-guard + acl-injector + preflight</name>
  <files>plugins/zama-skills/skills/contract/scripts/lib/cleartext-guard.ts, plugins/zama-skills/skills/contract/scripts/lib/acl-injector.ts, plugins/zama-skills/skills/contract/scripts/lib/preflight.ts, plugins/zama-skills/skills/contract/scripts/generate.test.ts</files>
  <behavior>
    - cleartext-guard: input "require(FHE.decrypt(x))" → throws with suggested replacement
    - cleartext-guard: input "if (decrypt(x))" → throws
    - cleartext-guard: input "euint64 a; euint64 b; if (a == b)" → throws (typed comparison)
    - cleartext-guard: input "ebool c = FHE.lt(a,b);" → passes
    - acl-injector: assignment "balance = FHE.add(balance, amount);" → appends "FHE.allowThis(balance);" on next line
    - acl-injector: function returns handle → adds "FHE.allow(<handle>, msg.sender);" before return
    - acl-injector: idempotent (running twice does not duplicate grants)
    - preflight: missing packages/contracts → returns error with "Run /zama-init first"
    - preflight: present + writable → returns ok
  </behavior>
  <action>
Implement TypeScript modules per the <interfaces> contract.

`cleartext-guard.ts`:
- Export `FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; name: string; replacement: string }>` (12 entries minimum: require(decrypt), if(decrypt), 6 comparison ops on euint*/ebool, plus typed-eq variants).
- Export `assertNoCleartextLeak(source: string): void` — throws `CleartextLeakError` containing the matched pattern name + replacement suggestion.
- Use a lightweight regex pass; do NOT pull a full Solidity parser.
- For comparison-op detection, parse only declared variable types (regex `(euint\d+|ebool)\s+(\w+)`) then check `\b<name>\s*(==|!=|<|>|<=|>=)`. False positives acceptable (better safe).

`acl-injector.ts`:
- Export `injectAclGrants(source: string): { source: string; injected: number }`.
- Detect storage-slot assignments of encrypted handles (lhs declared as `euint*`/`ebool`/`eaddress` storage var). Insert `FHE.allowThis(<lhs>);` on next line if not already present.
- Detect functions whose return type is encrypted; before `return <expr>;` insert `FHE.allow(<expr>, msg.sender);` if missing.
- Idempotency: skip if next non-blank line already matches `FHE.allowThis(<same handle>)` or `FHE.allow(<same handle>, msg.sender)`.

`preflight.ts`:
- Export `preflight(): { ok: boolean; error?: string }` — checks `packages/contracts/contracts/` exists and is writable, and `package.json` lists `@fhevm/solidity` (use the version helper from `scripts/lib/versions.ts` if available; otherwise read JSON directly).
- CLI mode: when invoked as `node preflight.ts`, prints message and exits non-zero on failure.

Tests live in `generate.test.ts` (vitest) covering all behaviors above.
  </action>
  <verify>
    <automated>pnpm vitest run plugins/zama-skills/skills/contract/scripts/generate.test.ts</automated>
  </verify>
  <done>All vitest cases pass; cleartext-guard catches the 4 sample leaks; acl-injector idempotent on a sample contract; preflight returns "Run /zama-init first" on bare dir.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Implement generate.ts + 3 Solidity templates</name>
  <files>plugins/zama-skills/skills/contract/scripts/generate.ts, plugins/zama-skills/skills/contract/assets/templates/contract.sol.tpl, plugins/zama-skills/skills/contract/assets/templates/erc7984.sol.tpl, plugins/zama-skills/skills/contract/assets/templates/votes.sol.tpl</files>
  <behavior>
    - generate({name:"Counter", base:"standalone", schema:[{name:"counter",type:"euint64"}], decryptionPath:"user"}) → writes packages/contracts/contracts/Counter.sol containing HCU header, FHE import, euint64 counter, FHE.allowThis after assignment, FHE.allow on getter, no decrypt() calls
    - generate({base:"erc7984"}) → uses erc7984.sol.tpl, imports @openzeppelin/confidential-contracts/token/ERC7984.sol
    - generate({base:"votes"}) → uses votes.sol.tpl, imports VotesConfidential
    - generate with cleartext leak in user-provided field (impossible by schema — but template tampering test) → assertNoCleartextLeak throws
    - generate twice with same name without --force → second call aborts with "file exists" error
    - generate output has zero occurrences of "fhevmjs" or "import.*\"fhevm\"" (root deprecated package)
  </behavior>
  <action>
1. Templates use `${PIN:@fhevm/solidity}` etc. resolved via `scripts/lib/versions.ts` at generate-time. Each template:
   - Begins with HCU header comment (interfaces section, exact text).
   - SPDX `// SPDX-License-Identifier: BSD-3-Clause-Clear`.
   - `pragma solidity 0.8.27;`
   - Imports per <interfaces> for the chosen base.
   - `contract <Name> is SepoliaConfig { ... }` for standalone; appropriate `is ERC7984, SepoliaConfig` etc. for OZ bases.
   - State block placeholder `// __STATE__` replaced by generator from schema.
   - Function placeholders for one example state-write per field + one getter using the chosen decryption path.

2. `generate.ts`:
   - Parse `--inputs <json>` (or read JSON from stdin).
   - Load template by `base`.
   - Substitute placeholders: contract name, state declarations, sample setter/getter for each schema field with correct decryption-path code.
   - Run `injectAclGrants` (post-process).
   - Run `assertNoCleartextLeak` — if throws, print canonical replacement and exit 1.
   - Final post-grep: `grep -E 'fhevmjs|import\s+["\x27]fhevm["\x27]'` against generated source — fail if matches.
   - Write to `packages/contracts/contracts/<Name>.sol` (refuse overwrite without `--force`).
   - Print: file path, # ACL grants injected, # cleartext patterns checked.

3. Decryption-path code patterns (embed in templates as conditional blocks):
   - `public`: emit `FHE.makePubliclyDecryptable(handle);`
   - `user`: emit `FHE.allow(handle, msg.sender);`
   - `oracle`: emit relayer request stub with `FHE.requestDecryption(...)` and oracle callback skeleton.

4. Vitest cases for all behaviors in `generate.test.ts` (extend file from Task 2).
  </action>
  <verify>
    <automated>pnpm vitest run plugins/zama-skills/skills/contract/scripts/generate.test.ts && grep -RE "fhevmjs|^import\s+[\"']fhevm[\"']" plugins/zama-skills/skills/contract/assets/templates/ && exit 1 || exit 0</automated>
  </verify>
  <done>3 templates exist; generate.ts produces a Counter.sol that compiles with `pnpm hardhat compile` in a /zama-init'd workspace; no deprecated imports; ACL grants present; HCU header present.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User → SKILL.md prompt | Untrusted: contract name, schema field names |
| Generated Solidity → Sepolia | Anything emitted runs on-chain; cleartext leaks irreversible |
| Skill template → user repo | Template tampering could inject deprecated imports |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-01 | Information Disclosure | Generated Solidity | mitigate | `assertNoCleartextLeak` runs before writing file; refuses `require(decrypt(...))` etc. (Task 2) |
| T-04-02 | Tampering | acl-injector skipping a write | mitigate | Idempotent post-pass injects FHE.allowThis after every euint storage assignment; ACL invariant block in SKILL.md tells user not to remove (Task 1, 2) |
| T-04-03 | Tampering | Skill emits deprecated `fhevmjs`/`fhevm` imports | mitigate | Post-grep at end of generate.ts; pinned-versions.json is single source (Task 3) |
| T-04-04 | Spoofing | User passes `name=../../../etc/passwd` | mitigate | PascalCase regex validation in generate.ts; only allow `[A-Z][A-Za-z0-9]+` |
| T-04-05 | Denial of Service | Schema with 1000 fields → giant contract | accept | HCU reminder warns user; not a security issue, only gas |
| T-04-06 | Repudiation | n/a (local file generation) | accept | No multi-user trust boundary |
| T-04-07 | Elevation of Privilege | Missing FHE.allow → handle unusable, NOT plaintext leak | mitigate | acl-injector ensures grants are present; ACL block in SKILL.md |
</threat_model>

<verification>
1. `pnpm vitest run plugins/zama-skills/skills/contract/` — all green
2. Manual smoke: in a `/zama-init`'d project, run the skill end-to-end with `name=Counter, base=standalone, schema=[counter:euint64], decryptionPath=user`. Expect `packages/contracts/contracts/Counter.sol` created with no `fhevmjs`, with `FHE.allowThis(counter)`, `FHE.allow(counter, msg.sender)`, HCU header.
3. `pnpm hardhat compile` in that workspace exits 0.
4. Inject `require(decrypt(x))` into a template → generate aborts with replacement suggestion.
</verification>

<success_criteria>
- All 5 CONTRACT-* requirements satisfied (per truths block)
- 0 deprecated imports in any template or output
- 100% of state-write samples in templates have ACL grants
- Cleartext-guard rejects all 4 sample patterns from <interfaces>
- vitest green
</success_criteria>

<output>
Create `.planning/phases/04-other-4-skills/04-01-SUMMARY.md` with: files created, ACL injector count of grants on a sample run, # forbidden patterns, vitest summary, sample generated Counter.sol path.
</output>
