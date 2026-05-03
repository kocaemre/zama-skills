# Decryption Paths — Decision Tree

Zama Protocol exposes **three** ways to reveal an encrypted handle's plaintext. Choosing the wrong one leaks data or makes the dApp unusable. Always confirm with the user which path applies BEFORE generating decrypt logic.

## The three paths

### 1. Public decryption — `FHE.publicDecrypt`

- **Effect:** Plaintext becomes readable by anyone observing chain state.
- **Use when:** The result is intentionally public — e.g., final auction winner, vote tally, settled market price.
- **Trigger:** Solidity-side; result fanned out via the KMS network and indexed back into chain state.
- **Anti-use:** Never use for personal balances or private user inputs.

### 2. User decryption — relayer-sdk `userDecrypt` (client-side)

- **Effect:** Only the address holding the matching key can read plaintext. No other party (including the dApp deployer) sees it.
- **Use when:** Personal balances, private user inputs, per-user confidential state.
- **Trigger:** Frontend-side, using `@zama-fhe/relayer-sdk`. The contract must have called `FHE.allow(handle, userAddress)` first.
- **Anti-use:** Cannot be used for on-chain branching — value never returns to chain.

### 3. Oracle / async decryption — `FHE.requestDecryption` callback

- **Effect:** A relayer mediates an off-chain decryption and posts the plaintext back to a callback function on the contract.
- **Use when:** On-chain logic must conditionally branch on a plaintext value (e.g., compare two encrypted bids, settle a derivative, conditional transfers).
- **Trigger:** Solidity-side; relayer fulfills asynchronously. Has callback gas cost.
- **Anti-use:** Don't use for simple "show user their balance" — use path 2 instead (cheaper, more private).

## Decision rule

Ask the user which path applies BEFORE generating decrypt logic. **If unspecified, default-refuse and prompt for clarification.** Picking the wrong path is a privacy bug, not a feature gap.

## Cross-reference

Confirm the exact signature for the chosen path via context7 `/zama-ai/fhevm` `topic: "decryption"` — the API surface evolved across `@fhevm/solidity@0.10.x → 0.11.x` and the older examples on the open web are stale.
