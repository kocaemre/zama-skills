---
phase: 03-zama-init-end-to-end
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - plugins/zama-skills/skills/init/assets/seeds/confidential-token/Token.sol
  - plugins/zama-skills/skills/init/assets/seeds/confidential-token/scripts/register-token.ts
  - plugins/zama-skills/skills/init/assets/seeds/voting/Poll.sol
  - plugins/zama-skills/skills/init/assets/seeds/auction/SealedBidAuction.sol
  - plugins/zama-skills/skills/init/assets/seeds/custom/Skeleton.sol
autonomous: true
requirements: [INIT-01, INIT-02]
must_haves:
  truths:
    - "Each of 4 use-cases has a seed contract under assets/seeds/<use-case>/"
    - "Every state-mutating function ends with FHE.allowThis(handle) (or equivalent ACL grant)"
    - "Every seed imports from @fhevm/solidity (no deprecated imports)"
    - "confidential-token ships a register-token.ts script (registration call deferred to /zama-deploy)"
    - "custom seed has a deprecation-guard comment block at the top"
    - "Each seed compiles cleanly with solc 0.8.27 + @fhevm/solidity@^0.11.1 + OZ confidential 0.4.0 (verified by 03-06 smoke)"
  artifacts:
    - path: "plugins/zama-skills/skills/init/assets/seeds/confidential-token/Token.sol"
      provides: "ERC7984ERC20Wrapper minimal mint/transfer demo"
      contains: "ERC7984ERC20Wrapper"
    - path: "plugins/zama-skills/skills/init/assets/seeds/voting/Poll.sol"
      provides: "VotesConfidential demo poll"
      contains: "VotesConfidential"
    - path: "plugins/zama-skills/skills/init/assets/seeds/auction/SealedBidAuction.sol"
      provides: "Sealed-bid auction over euint64"
      contains: "euint64"
    - path: "plugins/zama-skills/skills/init/assets/seeds/custom/Skeleton.sol"
      provides: "Empty FHE-imported skeleton with ACL reminder"
      contains: "FHE.allowThis"
  key_links:
    - from: "every seed"
      to: "@fhevm/solidity/lib/FHE.sol"
      via: "import statement"
      pattern: "import.*@fhevm/solidity"
---

<objective>
Author 4 minimum-viable Solidity seed contracts (one per use-case) plus the deferred register-token.ts script for confidential-token. Each seed must compile cleanly against pinned-versions.json's stack and demonstrate the correct ACL pattern.

Purpose: When the user picks a use-case in /zama-init, this seed becomes their starting contract — it MUST be technically correct so they can run /zama-contract on top of it without inheriting bugs.
Output: 5 files (4 .sol + 1 .ts script). Comments cite Zama doc URLs (not contract addresses).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/03-zama-init-end-to-end/03-CONTEXT.md
@.planning/phases/03-zama-init-end-to-end/ORCHESTRATION.md
@plugins/zama-skills/shared/snippets/acl-tip.md
@plugins/zama-skills/shared/snippets/deprecation-guard.md
@plugins/zama-skills/shared/context7-query.md

<interfaces>
- Solidity pragma: `^0.8.24` (compatible with pinned 0.8.27).
- Required imports:
  - `import {FHE, euint8, euint16, euint32, euint64, ebool, eaddress, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";`
  - For confidential-token: `import {ERC7984ERC20Wrapper} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol";` (verify exact path via context7 `/websites/openzeppelin_confidential-contracts` topic:`"ERC7984"` at authoring time)
  - For voting: `import {VotesConfidential} from "@openzeppelin/confidential-contracts/governance/utils/VotesConfidential.sol";` (verify path via context7)
- ACL rule (from acl-tip.md): after every state write that creates or returns an encrypted handle, call `FHE.allowThis(handle)`. For handles returned to a specific user, also `FHE.allow(handle, user)`.
- ACL pattern reminder must appear as a code comment in every seed.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Confidential-token seed (Token.sol + register script)</name>
  <files>
    plugins/zama-skills/skills/init/assets/seeds/confidential-token/Token.sol,
    plugins/zama-skills/skills/init/assets/seeds/confidential-token/scripts/register-token.ts
  </files>
  <action>
**Authoring discipline**: BEFORE writing the .sol file, query context7 `/websites/openzeppelin_confidential-contracts` topic:`"ERC7984"` to confirm the exact import path and constructor signature for `ERC7984ERC20Wrapper`. Pin the result in a comment at the top of Token.sol citing the doc URL (not the address).

**`Token.sol`** structure:
- License: `// SPDX-License-Identifier: MIT`
- Pragma: `pragma solidity ^0.8.24;`
- Header comment: 4-line block citing Zama docs URL `https://docs.zama.org/protocol/solidity-guides/getting-started/quick-start-tutorial` and noting "registration with Confidential Token Registry is deferred to /zama-deploy"
- Import `FHE`, `euint64`, `externalEuint64`, `ebool`, `eaddress` from `@fhevm/solidity/lib/FHE.sol`
- Import `ERC7984ERC20Wrapper` (path confirmed via context7)
- Import `IERC20` and `Ownable` from `@openzeppelin/contracts`
- Contract `Token is ERC7984ERC20Wrapper, Ownable`:
  - Constructor `(IERC20 underlying)` passes through to wrapper, calls `Ownable(msg.sender)`
  - One demo function `mintConfidential(externalEuint64 encryptedAmount, bytes calldata inputProof)` that:
    1. Calls `FHE.fromExternal(encryptedAmount, inputProof)` to materialize `euint64 amount`
    2. Calls `_mintConfidential(msg.sender, amount)` (or whatever wrapper exposes — verify via context7)
    3. Calls `FHE.allowThis(amount)` and `FHE.allow(amount, msg.sender)` (ACL grant)
  - Inline comment near the ACL calls: `// ACL: every euint that survives this transaction must be granted to msg.sender or this contract — see shared/snippets/acl-tip.md`

**`scripts/register-token.ts`** — TypeScript scaffold (NOT executed by /zama-init):
- Header comment: "// Deferred — DO NOT run from /zama-init. /zama-deploy invokes this after Sepolia deploy."
- Skeleton: imports `ethers`, reads contract address from arg, fetches Confidential Token Registry address via `WebFetch` of `https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia` (no hardcoded address), calls registry's `register(token)` method
- Mark TODO: actual implementation lives in Phase 4 /zama-deploy
- Must NOT import fhevmjs

If context7 returns ambiguous results for the ERC7984ERC20Wrapper signature, prefer the simpler base `ERC7984` with a TODO comment to upgrade to wrapper variant in /zama-contract.
  </action>
  <verify>
    <automated>
      test -f plugins/zama-skills/skills/init/assets/seeds/confidential-token/Token.sol && \
      test -f plugins/zama-skills/skills/init/assets/seeds/confidential-token/scripts/register-token.ts && \
      grep -q "@fhevm/solidity" plugins/zama-skills/skills/init/assets/seeds/confidential-token/Token.sol && \
      grep -q "ERC7984" plugins/zama-skills/skills/init/assets/seeds/confidential-token/Token.sol && \
      grep -q "FHE.allowThis" plugins/zama-skills/skills/init/assets/seeds/confidential-token/Token.sol && \
      grep -q "FHE.allow" plugins/zama-skills/skills/init/assets/seeds/confidential-token/Token.sol && \
      ! grep -E "fhevmjs|^import.*\"fhevm\"" plugins/zama-skills/skills/init/assets/seeds/confidential-token/Token.sol && \
      ! grep -q "fhevmjs" plugins/zama-skills/skills/init/assets/seeds/confidential-token/scripts/register-token.ts
    </automated>
  </verify>
  <done>Token.sol uses ERC7984 wrapper from OZ, has ACL grants on every state write, register-token.ts is a deferred scaffold with no fhevmjs.</done>
</task>

<task type="auto">
  <name>Task 2: Voting + Auction + Custom seeds</name>
  <files>
    plugins/zama-skills/skills/init/assets/seeds/voting/Poll.sol,
    plugins/zama-skills/skills/init/assets/seeds/auction/SealedBidAuction.sol,
    plugins/zama-skills/skills/init/assets/seeds/custom/Skeleton.sol
  </files>
  <action>
**Authoring discipline (all 3)**:
- Query context7 `/zama-ai/fhevm` with topic `"auction"` before writing SealedBidAuction.sol.
- Query context7 `/websites/openzeppelin_confidential-contracts` with topic `"VotesConfidential"` before writing Poll.sol.
- ACL grant after every state write — non-negotiable. Comment cites `shared/snippets/acl-tip.md`.

**`voting/Poll.sol`**:
- License + pragma 0.8.24 + header comment with docs URL.
- Inherits `VotesConfidential` (path confirmed via context7) — if the OZ API doesn't yet expose a fully-functional VotesConfidential standalone, fall back to a minimal hand-rolled poll using `euint32` for vote counts and `mapping(address => ebool) hasVoted`.
- Functions:
  - `createPoll(bytes32 question)` — owner only
  - `vote(externalEuint32 encryptedChoice, bytes calldata inputProof)` — `FHE.fromExternal` + accumulate into encrypted tally + `FHE.allowThis(newTally)`.
- Comment block on ACL pattern.

**`auction/SealedBidAuction.sol`**:
- Custom `euint64` sealed-bid pattern (CONTEXT explicit: no OZ primitive).
- State: `euint64 highestBid`, `eaddress highestBidder`, `uint256 endsAt`
- `bid(externalEuint64 encryptedAmount, bytes calldata inputProof)`:
  1. `euint64 amount = FHE.fromExternal(encryptedAmount, inputProof)`
  2. `ebool isHigher = FHE.gt(amount, highestBid)`
  3. `highestBid = FHE.select(isHigher, amount, highestBid)`
  4. `highestBidder = FHE.select(isHigher, FHE.asEaddress(msg.sender), highestBidder)` (verify exact cast helper via context7; if `asEaddress` doesn't exist, use the documented pattern)
  5. `FHE.allowThis(highestBid); FHE.allowThis(highestBidder);`
- `settle()` — only after `endsAt`, allow winner to decrypt: `FHE.allow(highestBid, /*winner*/); FHE.allow(highestBidder, msg.sender);`
- Header comment cites context7 `/zama-ai/fhevm` topic:"auction".

**`custom/Skeleton.sol`**:
- License + pragma 0.8.24.
- **Top-of-file deprecation-guard comment block** (per CONTEXT specifics): 8-10 line `/* */` block listing the 2 deprecated packages (`fhevmjs`, `fhevm`) and 2 incompatibles (`hardhat@3`, `ethers@5`) with the canonical refusal text from `shared/snippets/deprecation-guard.md`.
- Empty contract `Skeleton` with:
  - Imports `FHE`, all common encrypted types
  - One `_storeExample(externalEuint64 input, bytes calldata proof)` function showing the canonical pattern: `fromExternal` → assign → `allowThis` — but commented `// EXAMPLE — replace with your logic`
  - TODO comment: "Run /zama-contract to add your real logic with proper ACL handling"
  </action>
  <verify>
    <automated>
      test -f plugins/zama-skills/skills/init/assets/seeds/voting/Poll.sol && \
      test -f plugins/zama-skills/skills/init/assets/seeds/auction/SealedBidAuction.sol && \
      test -f plugins/zama-skills/skills/init/assets/seeds/custom/Skeleton.sol && \
      grep -q "FHE.allowThis" plugins/zama-skills/skills/init/assets/seeds/voting/Poll.sol && \
      grep -q "FHE.allowThis" plugins/zama-skills/skills/init/assets/seeds/auction/SealedBidAuction.sol && \
      grep -q "euint64" plugins/zama-skills/skills/init/assets/seeds/auction/SealedBidAuction.sol && \
      grep -q "FHE.allowThis" plugins/zama-skills/skills/init/assets/seeds/custom/Skeleton.sol && \
      grep -q "fhevmjs" plugins/zama-skills/skills/init/assets/seeds/custom/Skeleton.sol && \
      grep -E "deprecat" plugins/zama-skills/skills/init/assets/seeds/custom/Skeleton.sol && \
      ! grep -rEn "^import.*fhevmjs|^import.*\"fhevm/" plugins/zama-skills/skills/init/assets/seeds/
    </automated>
  </verify>
  <done>3 seeds exist, all use FHE.allowThis on state writes, custom seed has deprecation-guard comment block, no real (non-comment) deprecated imports anywhere.</done>
</task>

</tasks>

<verification>
- 5 files total: 4 .sol + 1 .ts script.
- Recursive grep confirms zero `fhevmjs` import lines and zero `import "fhevm/..."` lines (the word "fhevmjs" is allowed only inside the deprecation-guard comment block of Skeleton.sol).
- Each .sol uses `@fhevm/solidity/lib/FHE.sol`.
- Each .sol calls `FHE.allowThis(...)` (or `FHE.allow(...)`) at least once.
- Compile-green is verified by 03-06's integration smoke (not in this plan — this plan only authors).
</verification>

<success_criteria>
- INIT-01 (use-case branching) — 4 distinct seeds for the 4 use-cases.
- INIT-02 (deprecation-free) — recursive grep clean.
- Token.sol uses ERC7984 family, Poll.sol uses VotesConfidential (or documented fallback), SealedBidAuction uses custom euint64 pattern, Skeleton.sol carries the deprecation-guard banner.
</success_criteria>

<output>
After completion, create `.planning/phases/03-zama-init-end-to-end/03-03-SUMMARY.md` listing each seed file, its primary import, the context7 query used at authoring time, and any signature ambiguities resolved (or fallbacks taken).
</output>
