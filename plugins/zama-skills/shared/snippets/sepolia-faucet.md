# Sepolia Setup — URLs Only

> **Never hardcode contract addresses in generated code.** Zama updates ACL / KMS / Coprocessor / Confidential Token Registry addresses periodically. Skills MUST WebFetch the live registry at runtime.

## Live address registry (fetch at runtime)

- **URL:** `https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia`
- **Contract:** Skill MUST WebFetch this URL at runtime; never pin in source.

## Sepolia faucets (request testnet ETH)

- `https://sepoliafaucet.com/` (Alchemy)
- `https://www.infura.io/faucet/sepolia` (Infura)
- `https://faucet.quicknode.com/ethereum/sepolia` (QuickNode)

## RPC provider env-var pattern

Use the env-var convention from `fhevm-hardhat-template`:

- `INFURA_API_KEY` — for Infura Sepolia RPC
- `ALCHEMY_API_KEY` — for Alchemy Sepolia RPC
- `MNEMONIC` — for the deployer wallet (BIP-39 phrase, never commit)

## Relayer URL

Confirm the **current relayer URL** via context7 `/zama-ai/fhevm` `topic: "relayer"` before emitting any relayer-sdk init code. The URL has historically been `https://relayer.testnet.zama.org` but treat it as runtime-fetched, not source-pinned.

## Hard rule

**Never include hardcoded ACL, KMS, Coprocessor, or Confidential Token Registry addresses in generated code.** Read them from a runtime config object populated by a WebFetch of the registry URL above, or from the relayer SDK's auto-discovery if available.
