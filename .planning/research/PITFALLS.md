# Pitfalls Research

**Domain:** AI agent skill package + Zama fhEVM zero-to-deploy scaffolder + bounty submission
**Researched:** 2026-05-03
**Confidence:** HIGH for fhEVM technical pitfalls (verified via context7 `/zama-ai/fhevm` and `/websites/openzeppelin_confidential-contracts`); HIGH for skill-design pitfalls (verified against Anthropic docs + obra/superpowers); MEDIUM-HIGH for bounty-specific pitfalls (inferred from generic dev-program judging patterns + Zama community signals — no public Season 2 judge rubric).

> Three categories below — A. fhEVM/FHE technical, B. Claude Code skill design, C. Submission/bounty. Each pitfall maps to a phase from ARCHITECTURE.md "Suggested Build Order."

---

## A. fhEVM / FHE Technical Pitfalls (the code our skills generate)

### Pitfall A1: Forgot `FHE.allowThis(...)` after writing to encrypted state (THE most common fhEVM bug)

**What goes wrong:**
A function computes a new `euint*` ciphertext and stores it. On the next transaction, any operation that uses that ciphertext (including a re-read by the same contract) reverts, OR a user-decrypt request via the relayer fails silently with no plaintext returned.

**Why it happens:**
The ACL is *not implicit*. Writing `_count = FHE.add(_count, evalue)` does NOT grant the contract permission to use `_count` later. Both `FHE.allowThis(_count)` (contract) AND `FHE.allow(_count, msg.sender)` (caller, for user-decrypt) are required after every write that produces a new handle. Per Zama docs verbatim: *"Both contract and caller permissions are necessary"* (`/zama-ai/fhevm` quick-start tutorial). The Zama docs also explicitly call out an `initializeUint32Wrong` example: *"omits granting permissions to the contract itself using `FHE.allowThis(...)`. This omission will cause user decryption attempts to fail because the contract needs permission to facilitate the decryption process"* (`/zama-ai/fhevm` `fhe-user-decrypt-single-value.md`).

**How to avoid:**
- `/zama-contract` SKILL.md MUST emit `FHE.allowThis(handle)` + `FHE.allow(handle, msg.sender)` immediately after every assignment that produces a new ciphertext. Bake this as a hard rule in the SKILL.md "Execute" section.
- Reinforce in `assets/snippets/erc7984-skeleton.sol` template — every `_update` / `_transfer` example includes both calls.
- Consider a hook (extends D3): grep generated Solidity for `(_\w+\s*=\s*FHE\.\w+\([^)]+\));` and warn if the next 3 lines lack `FHE.allowThis(`.

**Warning signs:**
- `npx hardhat test` passes for the *first* call but reverts on the *second* call to a function that re-reads the same state (transient ACL expired across txs).
- Frontend `userDecrypt` returns empty / errors with `UserDecryptionRequest` event present but no `UserDecryptionResponse`.
- HCU consumed unusually low (operation rejected before computation).

**Phase to address:** Phase 4 (`/zama-contract` skill body + assets) and Phase 6 (D3 hook upgrade).

---

### Pitfall A2: Decrypting at the wrong layer (contract vs gateway oracle vs user/frontend)

**What goes wrong:**
Skill emits a contract that calls `FHE.decrypt(...)` synchronously expecting a return value, OR emits frontend code that hits the gateway HTTP API for what should be a public on-chain decryption, OR uses `requestDecryption` (oracle callback) when a `userDecrypt` (private) was intended — leaking what should stay private to all observers.

**Why it happens:**
fhEVM has THREE decryption paths and they're easy to confuse:
1. **Public decryption** — `FHE.makePubliclyDecryptable(handle)` + oracle callback. Result becomes plaintext on-chain, visible to everyone. Use only when revealing to the world (e.g., final auction winner, vote tally).
2. **User decryption** — `userDecryption` HTTP request via relayer SDK. Plaintext returned only to the requesting user, off-chain. Use for "show user their own balance."
3. **Re-encryption** — variant of user decryption. The Gateway "is not a trusted party … at most it would be able to ignore requests" (`/zama-ai/fhevm/coprocessor/docs/fundamentals/overview.md`). It NEVER returns plaintext synchronously — async oracle callback only.

Mistake: emitting a contract that does `uint32 plain = FHE.decrypt(handle); emit ValueRevealed(plain);` and shipping it as "the user can see their balance now." That makes every user's balance public on-chain.

**How to avoid:**
- `/zama-contract` SKILL.md instructs Claude to ASK the user up front: "Should this value be revealed (a) to the world, (b) only to the caller, (c) only to a specific address?"
- Map answer → primitive: (a) `FHE.makePubliclyDecryptable` + public-decrypt oracle, (b) `FHE.allow(_, msg.sender)` + frontend `userDecrypt`, (c) `FHE.allow(_, target)` + frontend `userDecrypt`.
- `/zama-frontend` ships `useDecrypted(handle)` hook (D4) that ONLY uses `userDecrypt` — never calls a public decryption path. If the user wants public reveal, they call the contract function (which emits a request to the oracle) and the frontend listens for the resulting event.
- Validation step in skill: grep generated Solidity for `FHE.decrypt(` (a synchronous decrypt call that doesn't exist in current fhEVM — old API); reject and rewrite to the request-oracle pattern.

**Warning signs:**
- Generated contract has `FHE.decrypt` returning a uint synchronously → API doesn't exist that way; will not compile or will leak.
- Tx emits a plaintext-looking value in an event from a function the user thought was "private."
- Frontend code imports `decrypt` from a contract ABI rather than calling `instance.userDecryption(...)` from relayer-sdk.

**Phase to address:** Phase 4 (`/zama-contract` + `/zama-frontend` skills); Phase 2 (codify the 3-paths decision tree in `shared/prompts/decryption-paths.md`).

---

### Pitfall A3: Plaintext leakage via events, public storage, or revert reasons

**What goes wrong:**
Contract logic looks correct (uses `euint*`, ACL granted) but leaks the underlying value through:
- `emit Transferred(from, to, amount)` where `amount` is plaintext extracted via decrypt, OR worse, where the developer emits an `euint64` cast to uint (still leaks via type confusion in some toolchains).
- `require(amount > 0, "amount=42 too high")` — revert reason includes plaintext.
- Branching on plaintext (`if (decrypted_balance < 100) revert;`) — observer sees the revert and learns balance < 100. Per Zama sealed-bid auction tutorial: *"highlights the importance of not reverting transactions on insufficient funds, instead transferring a zero value to prevent information leaks"* (`/zama-ai/fhevm/docs/examples/sealed-bid-auction-tutorial.md`).
- Storing intermediate plaintext in a `public uint256` for "debug" and forgetting to remove it.

**Why it happens:**
Solidity reflexes are wrong for FHE. In normal Solidity, `revert("not enough balance")` is fine. In FHE, the *fact* that you reverted is the leak. Devs trained on regular Solidity will write defensive checks that destroy confidentiality.

**How to avoid:**
- `/zama-contract` includes a "leakage checklist" in its checklist.md asset:
  1. No `require(condition_on_decrypted_value, ...)` — use `FHE.select` + zero-value fallback.
  2. No `emit Event(plaintext_int)` — emit the encrypted handle (bytes32) instead.
  3. No `public` visibility on uint storage holding decrypted intermediates.
  4. No conditional branching (`if`/`else`) based on FHE-decrypted values within a function — branches reveal which path executed.
- `/zama-deploy` runs a final "leakage scan" before deploy: greps for `require.*decrypt`, `emit.*uint(?:8|32|64|256)\b` in functions touching `euint*`.
- Reference Zama's auction example pattern (`FHE.select` + zero-transfer-on-failure) in `assets/snippets/auction-skeleton.sol`.

**Warning signs:**
- Code review surface: any `require(...)` inside a function with `euint*` parameters/state.
- Etherscan tx history shows revert reasons that vary based on hidden state.
- Frontend can correlate a failed tx with a specific user balance range without explicit decryption.

**Phase to address:** Phase 4 (`/zama-contract` + `/zama-deploy`); Phase 6 (extend D3 hook to grep for these patterns in generated Solidity).

---

### Pitfall A4: HCU (Homomorphic Complexity Unit) limit blowout

**What goes wrong:**
Generated function compiles, deploys, looks fine in isolated tests — but reverts on any non-trivial input on Sepolia because it exceeds the per-tx HCU limit. Per `/zama-ai/fhevm/docs/solidity-guides/hcu.md`: *"current devnet has an HCU limit of 20,000,000 per transaction and an HCU depth limit of 5,000,000 per transaction. If either HCU limit is exceeded, the transaction will revert."*

**Why it happens:**
FHE operations are 1000-10000× more expensive than plaintext. A loop of 10 `FHE.select` ops looks innocent but consumes serious HCUs. Devs write naive loops over encrypted arrays, do per-element comparisons, or chain many ops in one tx. The mock-utils in Hardhat plugin do NOT enforce HCU limits — local tests pass; Sepolia tx reverts.

**How to avoid:**
- `/zama-contract` SKILL.md includes "HCU budget" instruction: when generating code with `FHE.select`, `FHE.le`, `FHE.add` etc., estimate the cost (rough: ~100K HCUs per `FHE.add` on `euint64`) and warn if a function plausibly exceeds 20M.
- Prefer scalar versions (`FHE.add(x, 42)` not `FHE.add(x, FHE.asEuint(42))`) — explicit Zama best practice (`/zama-ai/fhevm/docs/solidity-guides/operations/README.md`).
- Discourage loops over encrypted arrays. If unavoidable, cap iterations and document.
- `/zama-test` includes a Sepolia smoke test (not just mock) for the `/zama-init` happy-path contract — catches HCU blowout before deploy.
- `hardhat-gas-reporter` already in stack; document expected HCU impact in `assets/checklist.md`.

**Warning signs:**
- Local mock tests (`npx hardhat test`) pass; Sepolia tx reverts with no clear reason.
- Function works for small inputs (e.g. single bid) but reverts when called with larger inputs.
- Generated contract has `for` loops with FHE ops inside.

**Phase to address:** Phase 4 (`/zama-contract`, `/zama-test`); Phase 5 (Sepolia smoke test in example dApp confirms real-network behavior).

---

### Pitfall A5: Encrypted input proof / handle binding errors

**What goes wrong:**
Frontend calls `instance.createEncryptedInput(...)` then submits the tx — but tx reverts with cryptic "input verification failed" or `ERC7984UnauthorizedUseOfEncryptedAmount`. OR: input was encrypted against wrong contract address / wrong user address and the proof is rejected.

**Why it happens:**
`createEncryptedInput(contractAddress, userAddress)` cryptographically binds the ciphertext to **both** the receiving contract AND the calling user. Per `/zama-ai/fhevm/docs/solidity-guides/inputs.md`: the input is bound at encryption time. If frontend uses `signer.address` but tx sent from a different account (e.g., session key, smart wallet), the proof verifier rejects. Also: handles must be passed to the contract function in EXACTLY the order they were added (`addBool` index 0, `add64` index 1, etc.) — swap them and verification passes but value semantics break silently.

**How to avoid:**
- `/zama-frontend` `useEncryptedInput` helper hook always pulls `userAddress` from the *currently-connected signer* and `contractAddress` from the deployed contract address — never let user pass these manually.
- `/zama-contract` generates Solidity function signatures with parameter names matching frontend variable names so cross-binding is obvious.
- `/zama-test` includes the canonical input pattern (verified verbatim from `/zama-ai/fhevm/docs/solidity-guides/inputs.md`):
  ```typescript
  const input = fhevm.createEncryptedInput(contract.address, signers.alice.address);
  input.addBool(...); input.add64(...);
  const enc = await input.encrypt();
  // pass enc.handles[0], enc.handles[1], ..., enc.inputProof
  ```
- Add a runtime sanity check in `/zama-frontend`: log a warning if `signer.address !== window.ethereum.selectedAddress`.

**Warning signs:**
- Tx reverts with `InvalidProof` / `ERC7984UnauthorizedUseOfEncryptedAmount` (now a documented OZ error per `/websites/openzeppelin_confidential-contracts`).
- Inputs encrypted in dev with one wallet fail in prod with a different wallet.
- Two encrypted args appear to "swap" their roles in observed behavior.

**Phase to address:** Phase 4 (`/zama-frontend`, `/zama-test` skills).

---

### Pitfall A6: Sepolia-specific gotchas (registry, addresses, relayer)

**What goes wrong:**
Skill deploys a confidential token to Sepolia successfully but skips registering with the Confidential Token Registry (so wallets / explorers don't recognize it). OR: skill hardcoded a Sepolia ACL/KMS/Coprocessor address that Zama has since rotated, and runtime config is wrong. OR: relayer URL pinned in skill source becomes stale.

**Why it happens:**
- Zama publishes Sepolia addresses at https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia and updates them periodically (STACK.md gotcha #7).
- Many tutorials show contract deploy steps but stop before registry registration — the developer thinks "deploy = done."
- `SepoliaConfig` from relayer-sdk is the canonical source; manual config drift is a recurring forum issue.

**How to avoid:**
- `/zama-deploy/scripts/fetch-sepolia-addrs.mjs` fetches addresses live via WebFetch at deploy-time. NEVER pin in skill source (ARCHITECTURE.md Anti-Pattern 4).
- Frontend `/zama-frontend` SKILL.md prefers `import { SepoliaConfig } from "@zama-fhe/relayer-sdk"` over manual `aclContractAddress` / `kmsContractAddress` config — verbatim from `/zama-ai/fhevm/docs/sdk-guides/initialization.md`.
- `/zama-deploy` includes `register-token.mjs` (D5 in FEATURES.md) and EXPLICITLY runs it after deploy. README and skill closing summary call out the registry tx hash + clickable Etherscan link.
- Document Sepolia faucet rate limits + Alchemy/Infura RPC quota in README troubleshooting.

**Warning signs:**
- Token deploys cleanly but doesn't appear in confidential-token explorer / wallet UI.
- Relayer-sdk `createInstance` throws `Invalid contract address` or hangs during init.
- Frontend says "instance ready" but `userDecryption` requests time out.

**Phase to address:** Phase 4 (`/zama-deploy`); Phase 5 (live example dApp validates registry registration end-to-end).

---

### Pitfall A7: Test pollution — mock encrypt/decrypt diverges from real Sepolia behavior

**What goes wrong:**
Tests pass with `@fhevm/mock-utils` mocking encrypt/decrypt — but contract behaves differently on real Sepolia. Examples: mock doesn't enforce HCU limits (A4), mock ACL is permissive, mock decrypt is synchronous (real is async via gateway).

**Why it happens:**
Mock utils ship with the Hardhat plugin to make local TDD fast. They are not bit-exact emulators of the real coprocessor.

**How to avoid:**
- `/zama-test` SKILL.md emits TWO tiers of tests: (1) unit tests against mocks (fast), (2) at least ONE integration test guarded by `if (network.name === "sepolia")` that exercises the full async decrypt flow.
- README troubleshooting: "Mock tests pass but Sepolia reverts → check HCU + async decrypt + ACL transient vs permanent."
- Example dApp Phase 5 deploys to real Sepolia and verifies the round-trip — the example IS the final integration test.

**Warning signs:**
- 100% test coverage but first Sepolia tx reverts.
- Async oracle callbacks never fire in tests (because mock returns synchronously).

**Phase to address:** Phase 4 (`/zama-test`); Phase 5 (example dApp on real Sepolia).

---

### Pitfall A8: Importing deprecated packages (`fhevm`, `fhevmjs`)

**What goes wrong:**
Skill emits `import "fhevm/lib/FHE.sol"` (old root pkg) or `import { ... } from "fhevmjs"` (deprecated client). Install fails OR — worse — install succeeds against an old cached version and silently produces broken or insecure code.

**Why it happens:**
Both packages were officially deprecated 2025-07-10 (STACK.md). Most blog posts, ChatGPT/Claude training data, and Stack Overflow answers from 2024-early 2025 reference them. A skill that doesn't actively fight this drift will inherit it from Claude's pre-trained patterns.

**How to avoid:**
- Hard rule in every SKILL.md body: NEVER emit `fhevm` or `fhevmjs`. Use `@fhevm/solidity` and `@zama-fhe/relayer-sdk`.
- D3 hook (`shared/scripts/check-deprecated.mjs`) post-Write/Edit that greps and rejects deprecated imports.
- `shared/deprecated-imports.json` as single source of truth for the banlist.
- README troubleshooting section explicitly: "If you see `fhevmjs` anywhere, the skill regressed — file an issue."

**Warning signs:**
- `npm install` warns about deprecated dependencies.
- Generated `package.json` contains `fhevmjs` or `fhevm` (root).
- Frontend code has `import { ... } from 'fhevmjs'`.

**Phase to address:** Phase 2 (banlist in `shared/`); Phase 4 (instruction in every SKILL.md); Phase 6 (D3 hook enforcement).

---

## B. Claude Code Skill Design Pitfalls (what makes a skill package "feel bad")

### Pitfall B1: `description` doesn't trigger auto-invoke (or over-triggers)

**What goes wrong:**
User types "help me write an encrypted token" — Claude doesn't invoke `/zama-contract` because the `description` field doesn't include "encrypted" or "token" near the front. Or worse: `description` is so generic ("FHE helper") that it auto-invokes on every Solidity question, even non-fhEVM ones, polluting normal coding sessions.

**Why it happens:**
Anthropic's auto-invoke matches on `description` + `when_to_use` (combined cap 1,536 chars). Front-loaded keywords matter; vague openers ("This skill helps with...") waste the matching budget. Conversely, omitting bounds ("Use only when…") lets the skill fire on adjacent topics.

**How to avoid:**
- Every SKILL.md description leads with the CONCRETE use case + named primitives ("Generate confidential Solidity contracts using @fhevm/solidity v0.11.x and OpenZeppelin Confidential Contracts. Use when the user asks to write euint variables, FHE.add/sub/mul, ACL grants (FHE.allow), encrypted ERC20s (ERC7984)…")
- `when_to_use` includes explicit non-triggers ("Do NOT use for plain ERC20, generic Solidity, or non-confidential dApps").
- Manual smoke test: spin up Claude Code, type 5 phrasings of the intended trigger + 5 phrasings of an adjacent NON-trigger; verify auto-invoke fires/doesn't fire as expected. Document in `docs/release-checklist.md`.

**Warning signs:**
- User reports "I asked for a token and it didn't pick up the skill."
- User reports "the skill keeps interrupting unrelated work."
- Combined description+when_to_use length >1500 chars (close to the 1536 cap → keyword crowding).

**Phase to address:** Phase 1 (frontmatter scaffolding); Phase 4 (per-skill description tuning); Phase 6 (smoke-test all 5 in release checklist).

---

### Pitfall B2: Bloated SKILL.md (>500 lines) — Claude can't reason over it efficiently

**What goes wrong:**
SKILL.md grows past 500 lines (Anthropic's documented guideline). Auto-invoke still works but Claude's planning quality drops, response latency rises, and humans can't review. Worst case: Claude truncates and skips critical instructions (like "always run `FHE.allowThis` after writes").

**Why it happens:**
Authors are tempted to inline every Solidity template, every Q&A, every troubleshooting note. ARCHITECTURE.md Anti-Pattern 6 lists this explicitly as a known failure mode.

**How to avoid:**
- ARCHITECTURE.md decision: templates → `assets/`, scripts → `scripts/`, shared prompts → `shared/` with transclusion. SKILL.md stays a planner, not a content store.
- CI test: every SKILL.md (post-transclusion-expansion) ≤ 500 lines. Fail build if exceeded.
- Progressive disclosure: SKILL.md instructs Claude to `Read ${CLAUDE_SKILL_DIR}/assets/<variant>/skeleton.sol` only when the variant is selected.

**Warning signs:**
- SKILL.md >400 lines and still growing.
- New instructions duplicate ones already present.
- Claude's plan-step output omits steps you wrote (suggests truncation).

**Phase to address:** Phase 2 (transclusion engine + 500-line CI guard); Phase 4 (skill bodies authored with discipline).

---

### Pitfall B3: Hardcoded paths break across install scopes (personal vs project vs plugin cache)

**What goes wrong:**
SKILL.md references `./scripts/scaffold.mjs` with a relative path. Works during local dev; breaks when plugin is installed via `/plugin install` because Claude Code copies the plugin to a cache dir and the relative path no longer resolves to the same place. STACK.md gotcha #9.

**Why it happens:**
Devs test in-repo (where relative paths work) and don't simulate the install path. `${CLAUDE_SKILL_DIR}` is the supported substitution but easy to forget.

**How to avoid:**
- All references to bundled assets/scripts use `${CLAUDE_SKILL_DIR}/assets/...` or `${CLAUDE_SKILL_DIR}/scripts/...` — never `./...` or `../...`.
- All cross-skill references go through `shared/` (which lives inside the plugin dir, so `${CLAUDE_SKILL_DIR}/../shared/...` resolves correctly post-install).
- `test/install-cli.test.ts` runs the install CLI against a tmp scope and verifies skill files + assets land at expected paths.
- Manual end-to-end: install via `/plugin install` (NOT just running from clone) before submission.

**Warning signs:**
- "File not found" or "Script not found" errors only when running installed skill, not in-repo.
- Templates copy to user repo with truncated content (relative path resolved wrong).
- Hooks fail silently after install.

**Phase to address:** Phase 1 (manifest validation includes path patterns); Phase 6 (install-CLI test + manual VM test).

---

### Pitfall B4: Permission prompts at every tool call (UX death by 30 confirmations)

**What goes wrong:**
User runs `/zama-init` and is asked "allow Bash(npm install)?", "allow Write?", "allow Bash(npx hardhat compile)?", etc. — 30 prompts in one workflow. Demo dies; judge moves on.

**Why it happens:**
Default config requires per-tool confirmation. Without `allowed-tools` whitelist, every Bash/Write/Edit triggers a prompt.

**How to avoid:**
- Every SKILL.md declares `allowed-tools` covering the exact commands needed (FEATURES.md T5):
  - `/zama-init`: `Read Write Edit Bash(npm *) Bash(git clone *) Bash(npx hardhat *) WebFetch`
  - `/zama-test`: `Read Bash(npx hardhat test *)`
  - `/zama-deploy`: `Read Write Bash(npx hardhat run scripts/deploy.ts *) Bash(npx hardhat verify *) WebFetch` (+ `disable-model-invocation: true` so Claude doesn't auto-deploy)
- Test the flow on a fresh install — count prompts. Target: 0-2 per skill run (only side-effect operations like deploy).

**Warning signs:**
- User-reported "I clicked yes 20 times."
- Demo video shows confirmation modals between every step.
- `/zama-init` flow takes >5 minutes due to prompt latency.

**Phase to address:** Phase 1 (allowed-tools in scaffolded frontmatter); Phase 4 (per-skill tuning); Phase 6 (smoke test count).

---

### Pitfall B5: Generic prompts produce wrong code (the whole point of context7-aware to avoid)

**What goes wrong:**
SKILL.md says "Generate an FHE counter contract." Claude pulls from training data (which contains deprecated `fhevm` package patterns, old TFHE.sol API, fhevmjs imports). Output compiles maybe, looks plausible, is wrong.

**Why it happens:**
Without a context7 query forcing a fresh doc lookup, Claude defaults to training-data patterns. fhEVM API changed significantly between 2024 (`TFHE.allow`) and 2026 (`FHE.allow` / `FHE.allowThis`).

**How to avoid:**
- Every SKILL.md "Pre-flight (MANDATORY)" section transcludes `shared/context7-query.md` which instructs:
  ```
  Before generating ANY Solidity, JS, or config:
  1. mcp__context7__get-library-docs("/zama-ai/fhevm", topic: "<task>")
  2. mcp__context7__get-library-docs("/websites/openzeppelin_confidential-contracts", topic: "<task>")
  3. Cite the snippet you used (D12).
  ```
- `/zama-contract` "Validate" step: greps generated code for known-deprecated symbols (`TFHE\.`, `fhevmjs`, `FHE\.decrypt\(.*returns`).
- Closing summary lists which context7 snippet was the source — D12 in FEATURES.md, audit trail.
- README sells this loudly (D1) — judges see the technical advantage.

**Warning signs:**
- Generated code uses `TFHE.` (old API namespace; renamed to `FHE.` in `@fhevm/solidity@0.11.x`).
- Generated code uses `fhevmjs` or `fhevm` root package.
- Generated code uses old ACL pattern (`TFHE.allow(handle, addr)` without `allowThis`).

**Phase to address:** Phase 2 (context7-query.md + transclusion); Phase 4 (every SKILL.md transcludes it); Phase 6 (D3 hook catches what slips through).

---

### Pitfall B6: Skills fight each other (e.g., `/zama-contract` rewrites `/zama-init` scaffold)

**What goes wrong:**
User runs `/zama-init`, gets a working scaffold. Later runs `/zama-contract` to add a function — and that skill regenerates the whole file from its own template, blowing away `/zama-init`'s wiring.

**Why it happens:**
Each skill thinks of itself as the "owner" of the file it touches. Without explicit boundaries, Write operations clobber each other's output.

**How to avoid:**
- Boundary contract documented in each SKILL.md "Purpose" section: "/zama-contract MODIFIES existing contracts created by /zama-init; never creates a new project. If no project detected (no hardhat.config.ts), it INSTRUCTS the user to run /zama-init first."
- Detection logic in skill body: `Read hardhat.config.ts` first; if missing, refuse and redirect.
- `/zama-frontend` similarly checks for `frontend/` dir before adding components.
- ARCHITECTURE.md Boundary Rule 1: "No skill imports another skill's `assets/` or `scripts/`." Same principle extends to runtime: no skill assumes ownership of files another skill produced.

**Warning signs:**
- User runs two skills in sequence and the second wipes the first's output.
- Skill creates files in unexpected locations because it doesn't detect existing project layout.
- User reports "I had to start over after running the second skill."

**Phase to address:** Phase 4 (skill bodies include "detect existing project" preamble); Phase 6 (manual end-to-end runs all 5 skills in sequence).

---

## C. Submission / Bounty-Specific Pitfalls (what loses the prize even with great code)

### Pitfall C1: README doesn't communicate value in 30 seconds

**What goes wrong:**
Judge opens GitHub repo. README starts with "Setup", lists 12 dependencies, shows 200 lines of context before "what does this do." Judge bounces.

**Why it happens:**
Devs write READMEs for themselves (linear narrative). Judges scan top-of-page for hero + demo + install. Most fhEVM repos do not lead with a demo (FEATURES.md competitor analysis).

**How to avoid:**
- README structure (FEATURES.md T9, D11):
  1. **Hero line** — "Zero to deployed confidential dApp in 30 minutes via Claude Code."
  2. **Install snippet** — copy-pasteable, 2 lines (`/plugin marketplace add ...`).
  3. **90-second demo video** (D11) inline (GitHub embeds .mp4 in README).
  4. **Skills table** — 5 rows, one line each.
  5. **Live example links** — Sepolia contract address + Vercel frontend URL (T10).
  6. *Then* details, troubleshooting, contributing.
- Test: show README to someone unfamiliar with the project. Can they say what it does in 30 seconds?

**Warning signs:**
- README hero is "About this project" instead of "what you get + how to start."
- Install instructions appear after >2 scroll heights.
- No demo media (image, GIF, or video) in first viewport.

**Phase to address:** Phase 6 (README polish + demo video).

---

### Pitfall C2: Demo requires elaborate setup before it works (or it doesn't actually work end-to-end)

**What goes wrong:**
Judge installs plugin. Runs `/zama-init`. Hits an error — missing env var, wrong Node version, undocumented MetaMask network add, expired Sepolia faucet, etc. They stop. Submission gets "couldn't evaluate" rating.

**Why it happens:**
Developers test against their own machine state (cached deps, configured env, MetaMask already on Sepolia). They never test fresh-install on a clean VM. Vercel/community forum is full of "fhevm-react-template doesn't work for me" issues that trace to env wiring.

**How to avoid:**
- **MANDATORY before submission**: clean VM (macOS + Linux), fresh node install, no MetaMask network setup. Run `/plugin install zama-skills` → `/zama-init token` → confirm working scaffold + deploy + frontend.
- Document this manually in `docs/release-checklist.md` and run it as the final gate.
- D8 (MetaMask deep-link) eliminates one major friction point.
- T11 (`.env.example` scaffolding with prompts) eliminates env friction.
- Skill's first action: `Bash(node --version)` check — fail fast with clear message if <20.
- README troubleshooting section pre-answers known issues.

**Warning signs:**
- Demo only works on the author's machine.
- Setup requires >3 manual steps before the first command.
- Skill assumes existing tools/state without checking.

**Phase to address:** Phase 5 (example dApp validates real flow); Phase 6 (release checklist on clean VM).

---

### Pitfall C3: Claiming features that don't actually work end-to-end ("vaporware in the demo")

**What goes wrong:**
README claims "5 skills covering init/contract/test/deploy/frontend." But `/zama-deploy` was rushed and only works for the token variant; voting/auction variants throw cryptic errors. README claims "context7-aware" but only `/zama-contract` actually queries — others have placeholder text.

**Why it happens:**
Time pressure (7 days). Devs ship the README's promise before validating each claim. Judges WILL try unusual paths.

**How to avoid:**
- Before submission, run a coverage matrix: every skill × every supported variant × every documented example. If a cell breaks, EITHER fix it OR remove the claim from README/skill description.
- Honest scoping: README's "skills table" only lists what works end-to-end. Roadmap section calls out what's deferred to v2 (audit, debug — already deferred per PROJECT.md).
- Manual end-to-end test scripts in `docs/release-checklist.md`.
- Bonus: README "Limitations" section lists what doesn't work (token: yes; voting: yes; auction: stretch goal — explicitly). Honesty inverts judge perception.

**Warning signs:**
- README mentions a feature you never tested.
- Skill emits "TODO" or placeholder text for any branch.
- Coverage matrix has empty cells you "intend to fill in soon."

**Phase to address:** Phase 6 (release checklist + honest scope audit before submit).

---

### Pitfall C4: Misreading submission requirements / wrong format

**What goes wrong:**
Bounty asks for "GitHub repo URL + npm package URL + brief writeup." Submitter provides ZIP file and 50-page PDF. Auto-rejected at intake.

**Why it happens:**
Devs focus on the build, glance at requirements at the start, don't re-read at submission time. Requirements often list specific fields (chain ID for testnet deploy, license requirement, video format, etc.).

**How to avoid:**
- At project start (now), capture the EXACT submission form fields in `docs/SUBMISSION.md`. Re-verify the form 24h before deadline (rules sometimes update mid-program).
- Final-day checklist: every required field has content; no "TBD" anywhere.
- Submit 24h before deadline (not 5 minutes before) to allow recovery from form / file-size issues.

**Warning signs:**
- You haven't read the submission form recently.
- You're guessing what format judges want.
- You're planning to submit in the last hour.

**Phase to address:** Phase 1 (capture submission requirements doc); Phase 6 (final-day verification).

---

### Pitfall C5: Licensing issues (FHE.js / OpenZeppelin Confidential Contracts compatibility)

**What goes wrong:**
Project ships under MIT but bundles or distributes code from `@fhevm/solidity` (BSD-3-Clause-Clear) or OpenZeppelin Confidential Contracts (proprietary / non-MIT). Disqualified or required to relicense.

**Why it happens:**
Devs default to MIT without checking transitive licenses. fhEVM Solidity headers explicitly say `SPDX-License-Identifier: BSD-3-Clause-Clear`. OZ Confidential Contracts is currently shipped under specific terms (verify per current LICENSE on `OpenZeppelin/openzeppelin-confidential-contracts`).

**How to avoid:**
- Before publish, audit license headers of every file we bundle in `assets/`. Match SPDX identifiers to the upstream source.
- Generated code carries the appropriate SPDX header per source library.
- Repo `LICENSE` is MIT for our skill code; `assets/snippets/*.sol` carries upstream BSD-3-Clause-Clear where derived from `@fhevm/solidity`.
- Add `THIRD_PARTY_LICENSES.md` listing each bundled snippet → upstream + license.
- Verify OZ Confidential Contracts current license (was non-standard during preview); if it restricts redistribution, link to upstream rather than bundle.

**Warning signs:**
- LICENSE file says MIT but bundled .sol files have different SPDX headers.
- No record of where bundled snippets came from.
- OZ license terms not reviewed.

**Phase to address:** Phase 2 (set licensing policy when seeding `assets/`); Phase 6 (final license audit).

---

### Pitfall C6: Tests/lint failing at judge time (CI red on submission day)

**What goes wrong:**
Judge clicks the GitHub Actions tab. Sees red badges. Loses confidence even if code is good.

**Why it happens:**
Developer is iterating fast. Disabled CI temporarily to ship. Forgot to re-enable / fix.

**How to avoid:**
- CI required on main branch from Phase 1 onward. Never merge red.
- README has CI badge — green or absent (don't display red).
- Submission checklist: CI green on the exact commit being submitted.

**Warning signs:**
- "I'll fix CI later" — you won't.
- CI disabled on main.
- README shows red badge.

**Phase to address:** Phase 1 (CI from day 1); Phase 6 (verify green on submit commit).

---

### Pitfall C7: Skipping validation against official Zama examples / claiming superiority without proof

**What goes wrong:**
Submission claims "better than fhevm-react-template" without demonstrating what's different. Judge knows the template; sees no concrete delta.

**Why it happens:**
"Differentiator" lives in author's head, not in README.

**How to avoid:**
- README has a "How this differs from fhevm-react-template" comparison table (FEATURES.md competitor analysis already drafted it):
  - Use-case picker (template ships single counter)
  - Context7 live-query (template static)
  - Anti-deprecated guard (template can drift)
  - Decrypt UX hook (template skims frontend)
  - Registry registration finishing move (template stops at deploy)
- Demo video shows the specific "wow moments" the template doesn't have.

**Warning signs:**
- README never names the official template by reference.
- Claims of novelty without side-by-side.
- Reviewer asks "but what does this give me over the template?" and you can't answer in one sentence.

**Phase to address:** Phase 6 (README differentiator table + demo video).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|---|---|---|---|
| Hand-write `generic/*.md` instead of generating from SKILL.md | Skip writing transformer | Drift within 1-2 release cycles → Cursor users get stale instructions | Never — implement `generate-generic.mjs` even minimally in Phase 6 |
| Hardcode Sepolia ACL/KMS contract addresses in skill | Ship faster | Stale within ~weeks; silent deploy to dead contracts | Never — Anti-Pattern 4; always fetch live |
| Pin `fhevmjs` "for compatibility" with old tutorials | Bigger search-result match | Propagates dead code; defeats the whole anti-deprecation differentiator | Never |
| Skip `disable-model-invocation: true` on `/zama-deploy` | Less config | Claude auto-deploys when tests pass — could lose user funds (Sepolia is testnet but pattern carries to mainnet) | Never |
| Inline templates in SKILL.md instead of `assets/` | Fewer files | SKILL.md exceeds 500 lines, harder to review/maintain | Only for ≤20-line snippets |
| Skip integration test on real Sepolia, rely only on mocks | Faster CI | HCU blowouts + ACL bugs surface only in production | Acceptable in unit-test tier; never as the only test tier |
| Submit without clean-VM end-to-end test | Save 1 hour | Demo fails for judge; submission tanks | Never — final 24h must include this |
| Mainnet support "if time permits" | Broader appeal | Audit gap + skill bug = real funds lost; deferred to v2 per PROJECT.md | Never in v1 |
| Five separate plugins instead of one with five skills | Sounds modular | 5× install ceremony, breaks cross-skill `shared/` | Never (Anti-Pattern 1) |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|---|---|---|
| `@fhevm/hardhat-plugin` peers | Bumping `@zama-fhe/relayer-sdk` to latest in devDeps | Pin devDep to exact `0.4.1` (plugin peer); use `^0.4.2` only in frontend deps (STACK.md compat table) |
| `@openzeppelin/confidential-contracts@0.4.0` peer | Bumping `@fhevm/solidity` to next minor | OZ pins fhevm/solidity EXACTLY to `0.11.1` — keep in lockstep |
| Hardhat version | Using `hardhat@3.x` because "latest" | fhevm-plugin peer is `hardhat@^2.0.0`; use `^2.28.4` (STACK.md gotcha) |
| Ethers version | Using `ethers@5.x` because of legacy examples | fhevm-plugin and typechain output target `ethers@^6.16.0` |
| Sepolia RPC | Hardcode public RPC, hit rate limit during demo | Use Alchemy/Infura key; document in `.env.example`; mention public RPC fallback |
| MetaMask network add | Expect user to paste RPC manually | D8: generate `https://chainid.network/?...` deep-link in `/zama-init` final summary |
| Confidential Token Registry | Deploy ends; never registered | `/zama-deploy` runs `register-token.mjs` (D5) and prints registry tx hash |
| Relayer SDK init | Manual config drifts from current addresses | `import { SepoliaConfig } from "@zama-fhe/relayer-sdk"` (verbatim from `/zama-ai/fhevm/docs/sdk-guides/initialization.md`) |
| context7 MCP unavailable | Skill silently skips doc query | Document fallback in `shared/context7-query.md`: WebFetch `https://docs.zama.org/...` if MCP not responding |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|---|---|---|---|
| Loop with FHE ops over encrypted array | Sepolia tx reverts; mock tests pass | Cap iterations; warn if loop body has >2 FHE ops; prefer `FHE.select`-based unrolling | Any iteration count where total HCU > 20M (often <10 elements with multiple ops) |
| Non-scalar FHE.add (`FHE.add(x, FHE.asEuint(42))`) | Higher gas per op | Use scalar version `FHE.add(x, 42)`; called out in Zama "best practices" doc | Always wasteful; not a hard fail but compounds in batch ops |
| Excessive `FHE.allow` calls | High gas, ACL contract storage bloat | Use `FHE.allowTransient` for in-tx hand-offs; reserve `FHE.allow` for cross-tx persistence | Hot loops or batch ops |
| Frontend `userDecryption` per render | Latency + relayer rate-limit | `useDecrypted(handle)` hook caches by handle bytes32; revalidates only on handle change (D4) | High-update UIs (real-time dashboards) |
| Re-encrypting inputs on every keystroke | Encryption is expensive client-side | Debounce; only encrypt on submit | Forms with continuous validation |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---|---|---|
| `require()` on a decrypted value's predicate | Reveals predicate truth via revert/no-revert | Use `FHE.select` to branch via ciphertext; never branch via plaintext on confidential paths (Pitfall A3) |
| Emitting decrypted intermediate in event "for debugging" | Permanent on-chain plaintext leak | Never emit plaintext from confidential functions; use encrypted handles in events |
| `public` visibility on storage holding decrypted intermediate | Free read for anyone | Mark all FHE-derived intermediates `private` or `internal` |
| Using `FHE.allow(handle, msg.sender)` without `FHE.allowThis(handle)` | User can't actually decrypt (contract not authorized to facilitate) | Always pair both calls (Pitfall A1) |
| Granting persistent `FHE.allow` when `allowTransient` would do | Persistent ACL inflation; permission to a malicious contract survives if `address` was misjudged | Default to `allowTransient`; promote to `allow` only when cross-tx access is required |
| Misusing public-decrypt path for "show user their balance" | Balance becomes globally visible | Use `userDecryption` via relayer-sdk in frontend (Pitfall A2) |
| Frontend treats relayer URL as trusted oracle | Relayer can refuse to relay (liveness) but cannot leak (verified per `/zama-ai/fhevm` docs) — assumes single relayer is OK | Document in skill output: "relayer is not a trust party; multi-relayer fallback is a future hardening" |
| Bundling private key in `.env` and accidentally committing | Funds drained, repo blacklisted | `.env.example` scaffolding only; `.env` in `.gitignore` from Phase 1; pre-commit hook to grep for hex private keys |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---|---|---|
| 30 permission prompts during one `/zama-init` | User gives up | `allowed-tools` whitelist per skill (B4) |
| Skill silently runs for 2 minutes with no feedback | User thinks it crashed | Closing summary + per-step progress messages (D9) |
| Generated `.env` requires user to know which RPC provider to sign up for | First-time users blocked | `.env.example` with comments + links to Alchemy/Infura signup; default to public RPC for first run |
| MetaMask network add requires copy-paste of RPC URL + chain ID | Friction; many will mis-paste | D8 deep-link |
| Decryption shows "loading…" with no indication of async oracle delay | User thinks it hung | `useDecrypted` hook surfaces explicit "waiting on relayer (~5-15s)" status |
| Skill creates files outside expected dir (`~/foo.sol` instead of `contracts/foo.sol`) | User can't find them | All file ops scoped to detected project root |
| Two skills produce conflicting hardhat.config.ts | Demo broken | Boundary contract: only `/zama-init` writes the config; others append/edit specific fields (B6) |
| Demo video has no captions / audio | Inaccessible; some judges watch muted | Captions + clear visual demonstration without relying on audio |

---

## "Looks Done But Isn't" Checklist

Run before submission. If any unchecked, ship is not ready.

- [ ] **`/zama-init` token variant**: clean-VM install → `/plugin install` → `/zama-init token` → tests pass → deploy to Sepolia → frontend shows decrypted balance — ALL working without manual intervention beyond `.env` fill
- [ ] **`/zama-init` for each documented variant** (token + custom minimum; voting + auction if claimed): same flow works
- [ ] **`/zama-contract`**: invoked on existing `/zama-init` project, modifies contract correctly, ACL `allowThis` + `allow` emitted in every state-write
- [ ] **`/zama-test`**: encrypted-input mocking pattern works; at least one Sepolia integration test exists
- [ ] **`/zama-deploy`**: deploys to Sepolia AND registers with Confidential Token Registry; prints both tx hashes with explorer links
- [ ] **`/zama-frontend`**: `useDecrypted` hook works against real Sepolia; explicit "awaiting relayer" UX
- [ ] **Context7 query** actually fires in every skill — verify with logging on a test run
- [ ] **No `fhevmjs`, no `fhevm` (root)**, no `ethers@5`, no `hardhat@3` anywhere in generated code or assets
- [ ] **README**: hero + install + demo + skills table + live example URLs in first viewport
- [ ] **Demo video** ≤90s, captioned, embedded in README
- [ ] **Generic markdown rehbers** auto-generated and current (`generic-sync.test.ts` green)
- [ ] **CI green** on the exact commit being submitted
- [ ] **`disable-model-invocation: true`** on `/zama-deploy` (verify via frontmatter test)
- [ ] **`allowed-tools`** declared on every skill (verify via frontmatter test)
- [ ] **`argument-hint`** on every skill
- [ ] **License audit**: MIT for our code; BSD-3-Clause-Clear preserved on derived `@fhevm/solidity` snippets; OZ license verified and correctly attributed
- [ ] **`.env`** in `.gitignore`; no private keys in repo history
- [ ] **Submission form** fields all filled; submitted ≥24h before deadline
- [ ] **Live example dApp**: Sepolia contract verified on Etherscan; frontend live on Vercel; URLs in README work
- [ ] **No "TODO" / "coming soon"** strings in any user-facing docs

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---|---|---|
| A1 (forgot `allowThis`) | LOW | Add `FHE.allowThis(handle)` after every state-write; redeploy. Detected before deploy if `/zama-test` Sepolia smoke test runs. |
| A2 (wrong decrypt layer) | MEDIUM | Identify intent (public vs user); refactor to correct primitive. May require contract API change → migrate users. |
| A3 (plaintext leak via event/require) | HIGH | If on testnet: redeploy clean. If on mainnet: leak is permanent. Disclose, deprecate contract, restart. (Why we're testnet-only in v1.) |
| A4 (HCU blowout) | MEDIUM | Refactor to fewer ops or split across txs. May require state changes → migration. |
| A5 (input proof error) | LOW | Fix frontend to use connected signer's address; pin handle order to function param order. |
| A6 (wrong Sepolia addr) | LOW | Refresh `SepoliaConfig` import; rerun. |
| A7 (mock vs real divergence) | MEDIUM | Add Sepolia integration test; fix what breaks. |
| A8 (deprecated import) | LOW | Replace package; rerun install + tests. D3 hook prevents recurrence. |
| B1 (description trigger broken) | LOW | Reword description; smoke-test 5 phrasings. |
| B2 (bloated SKILL.md) | MEDIUM | Move templates to `assets/`, prompts to `shared/`; CI guard prevents recurrence. |
| B3 (hardcoded paths break) | LOW | Replace `./` with `${CLAUDE_SKILL_DIR}/`; reinstall; verify. |
| B4 (permission prompts) | LOW | Add `allowed-tools` to frontmatter. |
| B5 (generic prompts wrong code) | LOW | Add context7 transclusion; ship hotfix. |
| B6 (skills fight each other) | MEDIUM | Add detection preamble to each SKILL.md; document boundaries. |
| C1 (bad README) | LOW | Rewrite top half; add demo media. ~2 hours. |
| C2 (demo doesn't work) | MEDIUM-HIGH | Identify failure point; fix; re-test on clean VM. Could take a day mid-week, fatal in last 24h. |
| C3 (vaporware claims) | LOW | Trim README claims to match what works. |
| C4 (wrong submission format) | LOW if caught pre-deadline; FATAL if not | Re-read submission form; resubmit. |
| C5 (license issue) | MEDIUM | Audit + relicense; add `THIRD_PARTY_LICENSES.md`. |
| C6 (CI red) | LOW-MEDIUM | Fix tests; merge green commit; update submission to point to green commit. |
| C7 (no clear differentiator) | LOW | Add "How this differs" table to README. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---|---|---|
| A1 (no `allowThis`) | Phase 4 (`/zama-contract` body + assets) | `/zama-test` Sepolia smoke test passes; D3 hook (Phase 6) catches misses |
| A2 (wrong decrypt layer) | Phase 2 (decision-tree prompt) + Phase 4 (`/zama-contract`, `/zama-frontend`) | Manual review of `/zama-init` token variant — frontend uses `userDecryption`, not public path |
| A3 (plaintext leak) | Phase 4 (`/zama-contract` checklist asset) + Phase 6 (D3 hook regex) | Coverage matrix run + leak-scan in `/zama-deploy` |
| A4 (HCU blowout) | Phase 4 (`/zama-contract` budget instruction) + Phase 5 (real Sepolia) | Example dApp deploy succeeds + functional |
| A5 (input proof) | Phase 4 (`/zama-frontend`, `/zama-test` patterns) | Hardhat tests + manual end-to-end |
| A6 (Sepolia gotchas) | Phase 4 (`/zama-deploy` live-fetch) + Phase 5 | Registry tx hash exists + visible on explorer |
| A7 (mock vs real divergence) | Phase 4 (`/zama-test` two-tier) + Phase 5 | Sepolia integration test green |
| A8 (deprecated imports) | Phase 2 (banlist) + Phase 4 (instructions) + Phase 6 (D3 hook) | grep CI test |
| B1 (auto-invoke broken) | Phase 1 (frontmatter) + Phase 6 (smoke test) | 5×5 trigger matrix on real Claude Code |
| B2 (bloated SKILL.md) | Phase 2 (transclusion engine) + Phase 4 (discipline) | CI 500-line guard |
| B3 (hardcoded paths) | Phase 1 (manifest validation) + Phase 6 (install-CLI test) | `test/install-cli.test.ts` + manual VM install |
| B4 (permission prompts) | Phase 1 (allowed-tools in scaffolds) + Phase 4 (per-skill) | Manual end-to-end prompt count ≤2 per skill |
| B5 (generic prompts) | Phase 2 (context7-query.md) + Phase 4 (transclude) | Generated code grep for deprecated symbols |
| B6 (skills fight) | Phase 4 (boundary contracts in SKILL.md) | Manual run of all 5 skills in sequence |
| C1 (bad README) | Phase 6 | 30-second comprehension test |
| C2 (demo broken) | Phase 5 + Phase 6 release checklist | Clean VM install end-to-end |
| C3 (vaporware) | Phase 6 | Coverage matrix + scope audit |
| C4 (wrong format) | Phase 1 (capture requirements doc) + Phase 6 (re-verify) | Submission form fields filled |
| C5 (license) | Phase 2 (set policy) + Phase 6 (audit) | LICENSE + THIRD_PARTY_LICENSES.md present |
| C6 (CI red) | Phase 1 onward | Green badge on submit commit |
| C7 (no diff. shown) | Phase 6 (README diff. table + demo video) | Reviewer can name differentiator in 1 sentence |

---

## Sources

**Authoritative — fhEVM (verified via context7 `/zama-ai/fhevm` on 2026-05-03):**
- `docs/solidity-guides/getting-started/quick-start-tutorial/turn_it_into_fhevm.md` — `FHE.allowThis` + `FHE.allow(_, msg.sender)` requirement (Pitfall A1)
- `docs/solidity-guides/acl/acl_examples.md` — persistent vs transient ACL semantics
- `docs/solidity-guides/functions.md` — `allow`/`allowThis`/`allowTransient`/`isAllowed` API
- `docs/examples/fhe-user-decrypt-single-value.md` — explicit `initializeUint32Wrong` example showing the missing-`allowThis` failure mode (Pitfall A1)
- `docs/solidity-guides/decryption/oracle.md` + `coprocessor/docs/fundamentals/gateway/decryption.md` — public vs user decryption paths (Pitfall A2)
- `coprocessor/docs/fundamentals/overview.md` — Gateway trust model: not a trusted party, can affect liveness only
- `docs/solidity-guides/inputs.md` — `createEncryptedInput(contract, user)` binding + handle-order semantics (Pitfall A5)
- `docs/solidity-guides/hcu.md` — 20M HCU per-tx limit + 5M depth limit (Pitfall A4)
- `docs/solidity-guides/operations/README.md` — scalar operand best practice (Performance Traps)
- `docs/solidity-guides/logics/conditions.md` — `FHE.select` semantics; new ciphertext per assignment
- `docs/solidity-guides/logics/error_handling.md` — error-handler pattern (instead of revert-on-decrypted-predicate)
- `docs/examples/sealed-bid-auction-tutorial.md` — explicit "do not revert on insufficient funds; transfer zero" pattern (Pitfall A3)
- `docs/sdk-guides/initialization.md` — `SepoliaConfig` canonical init (Pitfall A6)
- `gateway-contracts/selectors.txt` — gateway error catalog

**Authoritative — OpenZeppelin Confidential Contracts (verified via context7 `/websites/openzeppelin_confidential-contracts` on 2026-05-03):**
- `api/token` — `ERC7984UnauthorizedUseOfEncryptedAmount`, `ERC7984UnauthorizedSpender`, `ERC7984InvalidGatewayRequest`, `ERC7984ZeroBalance` error catalog (Pitfall A5)
- `api/token` — `_update(from, to, value)` semantics: enforces transfer restrictions both sides

**Authoritative — Anthropic / Claude Code (HIGH confidence, cross-referenced from STACK.md + ARCHITECTURE.md):**
- https://code.claude.com/docs/en/skills — frontmatter, `disable-model-invocation`, `allowed-tools`, `${CLAUDE_SKILL_DIR}`, 1536-char description+when_to_use cap
- https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices — 500-line guideline, plan-validate-execute, one-skill-per-task
- https://code.claude.com/docs/en/plugin-marketplaces — marketplace.json schema, install commands, reserved name list

**Cross-reference from this milestone:**
- `.planning/research/STACK.md` — gotchas #1-10 (deprecated packages, Hardhat 3 incompat, address rotation, `${CLAUDE_SKILL_DIR}` requirement, etc.)
- `.planning/research/FEATURES.md` — T4, T5, T7, T9, T10, T11, T13, D1, D3, D4, D5, D8, D9, D10 directly inform pitfall prevention
- `.planning/research/ARCHITECTURE.md` — Anti-Patterns 1-7; Boundary Rules; build-order phases mapped above

**Confidence summary:**
- fhEVM technical pitfalls (A1-A8): **HIGH** — every pitfall traceable to a verbatim Zama doc snippet with source URL
- Skill-design pitfalls (B1-B6): **HIGH** — every pitfall traceable to Anthropic docs or empirically-observed pattern in obra/superpowers
- Bounty-specific pitfalls (C1-C7): **MEDIUM-HIGH** — extrapolated from generic dev-program judging patterns (no public Season 2 rubric); strongly grounded in observable submission failure modes

---
*Pitfalls research for: zama-skills (Claude Code skill package + fhEVM zero-to-deploy scaffolder + Zama Developer Program Mainnet Season 2 Bounty Track submission)*
*Researched: 2026-05-03*
