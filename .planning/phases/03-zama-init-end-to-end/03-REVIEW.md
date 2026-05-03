---
phase: 03-zama-init-end-to-end
reviewed: 2026-05-03T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - plugins/zama-skills/skills/init/SKILL.md
  - plugins/zama-skills/skills/init/scripts/scaffold.ts
  - plugins/zama-skills/skills/init/scripts/preflight.ts
  - plugins/zama-skills/skills/init/scripts/closing-summary.ts
  - plugins/zama-skills/skills/init/scripts/lib/pin-resolver.ts
  - plugins/zama-skills/skills/init/scripts/lib/manifest.ts
  - plugins/zama-skills/skills/init/scripts/scaffold.test.ts
  - plugins/zama-skills/skills/init/scripts/preflight.test.ts
  - plugins/zama-skills/skills/init/scripts/closing-summary.test.ts
  - plugins/zama-skills/skills/init/scripts/lib/pin-resolver.test.ts
  - plugins/zama-skills/skills/init/assets/seeds/confidential-token/Token.sol
  - plugins/zama-skills/skills/init/assets/seeds/confidential-token/scripts/register-token.ts
  - plugins/zama-skills/skills/init/assets/seeds/voting/Poll.sol
  - plugins/zama-skills/skills/init/assets/seeds/auction/SealedBidAuction.sol
  - plugins/zama-skills/skills/init/assets/seeds/custom/Skeleton.sol
  - plugins/zama-skills/skills/init/assets/templates/packages/contracts/hardhat.config.ts.tpl
  - plugins/zama-skills/skills/init/assets/templates/packages/contracts/package.json.tpl
findings:
  critical: 2
  warning: 6
  info: 3
  total: 11
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-05-03
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 3 ships the `/zama-init` end-to-end scaffolder: SKILL.md, runtime helpers (`scaffold.ts`, `preflight.ts`, `closing-summary.ts`, `pin-resolver.ts`, `manifest.ts`), seed contracts for four use-cases, and Vitest coverage. The architecture is sound — pure pin-resolver, DI-friendly preflight, separated manifest type, no `shell:true` in spawned processes — but several BLOCKERs land on the security/correctness axis: unbounded path traversal risk through both `--target` and template `destRel`, plus a deprecation-grep bypass for `package.json`. Solidity seeds compile-green but contain an ACL gap in `Poll.sol` that prevents owners from publishing tallies and unsafe `dirIsNonEmpty` semantics around `--force`.

## Critical Issues

### CR-01: Path traversal via template `destRel` and `--target`

**File:** `plugins/zama-skills/skills/init/scripts/scaffold.ts:495-530`
**Issue:** `walkTemplates` derives `destRel` from filenames on disk and passes it directly to `resolve(targetAbs, t.destRel)` and `fse.outputFile`. There is no guard that the resolved destination remains inside `targetAbs`. The same applies to `seed.extraScript.destRel` and `seedContractDest`. Although today's templates ship clean paths, a future contributor adding a template named `..%2Fevil.tpl` (or any rename that produces `..` segments after `.tpl` strip) silently writes outside the scaffold root. Combined with `--force`, this becomes an arbitrary-file-overwrite primitive driven by repo contents. The same lack of containment applies to `--target` itself: a user-supplied `~/.ssh` path is accepted with `--force` and merged.
**Fix:**
```ts
const dest = resolve(targetAbs, t.destRel);
if (!dest.startsWith(targetAbs + sep) && dest !== targetAbs) {
  throw new Error(`Refusing to write outside target: ${t.destRel}`);
}
```
Apply the same `startsWith` containment check to `seedContractDest` and `extraScript.destRel`. Additionally, refuse `--target` paths that resolve to `$HOME`, `/`, or any ancestor of CWD.

### CR-02: Deprecation grep silently skips JSON-comment lines and misses array/object dep entries

**File:** `plugins/zama-skills/skills/init/scripts/scaffold.ts:211-219, 248-261`
**Issue:** `isCommentLine` treats any line starting with `#` (or `//`, `/*`, `*`) as a comment and skips it — but this runs *before* the `isPkgJson` branch. A `package.json` written with a leading `#`-prefixed key (legal JSON: `"#fhevmjs": "0.6.2"`), or any wrapper where a malicious template inserts a `// comment` line above a dep, bypasses the guard. More importantly, the regex `/"fhevmjs"\s*:/` only matches the *key* form — it misses peer/optional/bundle dep lists that use array form (`"bundleDependencies": ["fhevmjs"]`) and misses the `"fhevm":` substring match if there is no space before the colon edge cases like `"fhevm":` are matched but `"fhevm" :` (space) is also matched only because `\s*` is greedy. The skip-comment-in-JSON behavior is the real BLOCKER: this guard claims to be belt-and-suspenders against deprecated leaks, but a contributor who comments deprecated entries with `//` (which Node's `JSON.parse` rejects but tooling like `npm` increasingly tolerates via JSON5) would pass the grep.
**Fix:** Do not run `isCommentLine` against `package.json`; JSON has no comments by spec. Move the comment skip strictly under the source-file branch:
```ts
if (isPkgJson) {
  if (/"fhevmjs"\s*:/.test(raw) || /"fhevm"\s*:/.test(raw) ||
      /["']fhevmjs["']/.test(raw) || /["']fhevm["']/.test(raw)) { ... }
  continue;
}
if (isCommentLine(raw)) continue;
```
Also extend to scan `bundleDependencies` array entries.

## Warnings

### WR-01: `dirIsNonEmpty` treats a regular file at the path as "occupied" but `--force` then proceeds to `fse.outputFile` against a non-directory

**File:** `plugins/zama-skills/skills/init/scripts/scaffold.ts:427-433, 441-445`
**Issue:** If `targetAbs` is an existing *file* (not directory), `dirIsNonEmpty` returns `true`. Without `--force` the user gets a clear error. With `--force`, scaffold proceeds; the first `fse.outputFile(resolve(targetAbs, t.destRel), …)` will fail with `ENOTDIR` mid-install, leaving a half-broken state and an unhelpful error. Either fail closed when target is a file regardless of `--force`, or `rm` it first.
**Fix:** In `scaffold()`, after `targetAbs` resolution, check `existsSync(targetAbs) && statSync(targetAbs).isFile()` and reject unconditionally with a clear message.

### WR-02: Partial-failure leaves scaffold tree in inconsistent state

**File:** `plugins/zama-skills/skills/init/scripts/scaffold.ts:541-573`
**Issue:** When `pnpm install` or `hardhat compile` fails, `scaffold()` throws *after* templates and seed contracts are already written. The user is left with a half-installed tree that the next `/zama-init` call will refuse (non-empty target). No cleanup, no rollback marker.
**Fix:** Either (a) document the recovery path in the thrown message ("re-run with `--force` to retry"), or (b) write a `.zama-init-state.json` sentinel and treat its presence as "incomplete — safe to overwrite" without `--force`.

### WR-03: `Poll.publishResults` exposes tallies but never re-grants ACL to the contract before `makePubliclyDecryptable`

**File:** `plugins/zama-skills/skills/init/assets/seeds/voting/Poll.sol:72-77`
**Issue:** After many `vote()` calls, `yesTally`/`noTally` are re-allowed to `address(this)` on every write — fine. But `publishResults()` calls `FHE.makePubliclyDecryptable` directly. Per fhEVM ACL semantics, `makePubliclyDecryptable` requires the *caller contract* to currently hold ACL access. If a vote occurred in a prior block and the ACL grant lifecycle has been touched (e.g., contract deletion + redeploy in mock tests, or a later upgrade), the call reverts. Defensive practice is `FHE.allowThis(...)` immediately before `makePubliclyDecryptable`. More importantly: there is no event emitted on result publication, so off-chain indexers cannot detect when decryption becomes valid.
**Fix:**
```solidity
function publishResults() external onlyOwner {
    require(block.timestamp >= endsAt, "Poll: still open");
    FHE.allowThis(yesTally);
    FHE.allowThis(noTally);
    FHE.makePubliclyDecryptable(yesTally);
    FHE.makePubliclyDecryptable(noTally);
    emit ResultsPublished();
}
```

### WR-04: `SealedBidAuction.bid()` lacks ACL grant of `amount` to the bidder before storing

**File:** `plugins/zama-skills/skills/init/assets/seeds/auction/SealedBidAuction.sol:38-53`
**Issue:** `FHE.fromExternal(encryptedAmount, inputProof)` materializes `amount`, then `FHE.gt(amount, highestBid)` and `FHE.select(...)` consume it. The bidder never receives an ACL grant on their own ciphertext — they can never re-decrypt their own bid. This is a UX/correctness defect: a confidential auction where bidders can't verify their own submissions is hostile to users. Also, `highestBidder` is set to `eaddress` of `msg.sender` but the loser's `eaddress` handle is dropped — fine for privacy, but `settle()` only grants `highestBidder` to public; the *winner* never gets `FHE.allow(highestBid, winnerAddr)`, so they cannot privately confirm the clearing price.
**Fix:** In `bid()`, add `FHE.allow(amount, msg.sender);` after `fromExternal`. In `settle()`, document the pattern for granting the winner private decryption (requires off-chain decrypt of `highestBidder` first — note this in a `///` comment).

### WR-05: `hardhat.config.ts.tpl` Sepolia accounts list is empty array when no MNEMONIC, breaking deploy with confusing "no accounts" error

**File:** `plugins/zama-skills/skills/init/assets/templates/packages/contracts/hardhat.config.ts.tpl:23`
**Issue:** `accounts: process.env.MNEMONIC ? { mnemonic: process.env.MNEMONIC } : []` — passing `[]` is valid hardhat config, but produces an opaque "no signer for sepolia" error when the user runs `pnpm hardhat run scripts/deploy.ts --network sepolia` without setting MNEMONIC. The template README mentions MNEMONIC, but a user pasting an `INFURA_API_KEY` and forgetting MNEMONIC will hit this. Better to throw at config load time with a pointed message.
**Fix:**
```ts
sepolia: process.env.MNEMONIC
  ? { url: rpcUrl, accounts: { mnemonic: process.env.MNEMONIC }, chainId: 11155111 }
  : undefined as never,
```
Or emit a `console.warn` at load when sepolia is referenced without MNEMONIC.

### WR-06: `Token.mintConfidential` ACL grant ordering — `_mint` may consume `amount` before transient grants stabilize

**File:** `plugins/zama-skills/skills/init/assets/seeds/confidential-token/Token.sol:34-43`
**Issue:** `_mint(msg.sender, amount)` is called *after* `FHE.allowThis(amount); FHE.allow(amount, msg.sender);`. ERC7984's `_mint` may internally re-store the handle into a balance mapping that requires ACL on the *receiver* (`msg.sender`) — which is granted — but if `_mint` constructs a derived ciphertext (e.g., `balance + amount`), that derived handle has no grants. Standard ERC7984 implementations call `FHE.allowThis(newBalance)` internally, but a reviewer cannot verify this without reading `@openzeppelin/confidential-contracts@0.4.0` source. The seed should add a `// NOTE: ERC7984._mint internally grants ACL on the new balance handle` comment, or the safer pattern: call `FHE.allow(amount, address(this))` *before* `_mint`, then `FHE.allow(amount, msg.sender)` *after* — and verify by writing a fhEVM-mock test in `/zama-test`.
**Fix:** Add a clarifying comment and add a Hardhat test asserting the receiver can decrypt their balance post-mint.

## Info

### IN-01: `closing-summary.ts` `coerceManifest` accepts mixed shapes silently — fragile

**File:** `plugins/zama-skills/skills/init/scripts/closing-summary.ts:52-74`
**Issue:** The dual-form acceptance ("legacy `string[]` or canonical `FileWritten[]`") was justified during Phase 3 wave overlap (per the file's own comment), but Plan 03-04 has now landed. The legacy shape can be removed. Keeping it adds a silent-coercion path: if a future caller emits `filesWritten: [{ wrong: "shape" }]`, `coerceManifest` produces `[undefined]` strings without error.
**Fix:** Drop the legacy `string[]` branch; require canonical `FileWritten[]`. Validate with `zod` (already a dep).

### IN-02: `parseArgs` in scaffold.ts silently ignores unknown flags

**File:** `plugins/zama-skills/skills/init/scripts/scaffold.ts:399-401`
**Issue:** `default: break;` swallows typos like `--no-instal` or `--targt`. The user gets the empty-dir error with no hint they mistyped. Print a warning on unknown args.
**Fix:** Add a `default:` clause that writes `pc.yellow(\`! ignoring unknown arg: ${a}\n\`)` to stderr.

### IN-03: `closing-summary.ts` defaultSharedDir hardcodes 3 levels of `..` — fragile if file moves

**File:** `plugins/zama-skills/skills/init/scripts/closing-summary.ts:260-265`
**Issue:** `resolve(here, "..", "..", "..", "shared")` works for the current layout but breaks silently if scripts/ depth changes. Reuse `findPluginRoot` from scaffold.ts (extract to `lib/`) for consistency with the rest of the runtime.
**Fix:** Move `findPluginRoot` into `scripts/lib/plugin-root.ts` and import from both files.

---

_Reviewed: 2026-05-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
