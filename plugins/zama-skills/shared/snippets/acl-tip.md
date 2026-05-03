# ACL Pattern Reminder

The Zama Protocol Access Control List (ACL) governs which addresses may decrypt a given encrypted handle (`euint*`, `ebool`, `eaddress`).

## Rule of thumb

Every state-write that produces or stores an encrypted handle MUST be followed by an ACL grant in the same transaction:

- `FHE.allowThis(handle)` — required so the contract itself can read the handle in subsequent calls. Forgetting this breaks future reads.
- `FHE.allow(handle, msg.sender)` — required if the caller needs to **user-decrypt** the value later via the relayer SDK.
- `FHE.allow(handle, otherAddress)` — grant decryption to a third party (e.g., counterparty in an auction settlement).

## Reference

- Library: `@fhevm/solidity@^0.11.1` ACL primitives (`FHE.allowThis`, `FHE.allow`, `FHE.makePubliclyDecryptable`).
- The ACL pattern **changed in `@fhevm/solidity@0.11.x`** — older examples (0.10.x and earlier) use a different API surface.
- Always verify the current signature via context7 `/zama-ai/fhevm` `topic: "acl"` before generating new patterns.

## Common mistake

Writing `state.balance = FHE.add(state.balance, amount)` without `FHE.allowThis(state.balance)` afterwards leaves the contract unable to read its own state next call. This will silently fail downstream.
