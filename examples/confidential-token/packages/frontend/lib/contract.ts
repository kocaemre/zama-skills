// Token contract address + ABI — single source of truth for every component
// that reads/writes the on-chain confidential token.
//
// Address resolution: read from `NEXT_PUBLIC_CONTRACT_ADDRESS` env var.
// Plan 04 wires this from the deploy script output. For local dev, copy
// `.env.local.example` → `.env.local` and paste the deployed address.
//
// We DO NOT throw at module evaluation — Next.js build pre-renders pages and
// would fail without the env var. Components query `getTokenAddress()` at
// render time and fall back to a helpful UX message if the address is missing.

import TokenArtifact from "./abi/Token.json";

// Token.json is a Hardhat artifact ({ contractName, abi: [...] }). wagmi's
// useReadContract / useWriteContract expect the bare ABI array — passing the
// whole artifact crashes with "r.filter is not a function" inside viem when
// it scans for the function entry. Unwrap here so every component gets the
// right shape.
type ArtifactShape = { abi?: unknown };
const artifact = TokenArtifact as unknown as ArtifactShape;
export const TOKEN_ABI = (Array.isArray(artifact.abi)
  ? artifact.abi
  : TokenArtifact) as readonly unknown[];

const RAW_ADDR = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "";

/**
 * TOKEN_ADDRESS — typed hex string for wagmi's `useReadContract` /
 * `useWriteContract`. Empty string when the env var is unset (handled by
 * `isTokenAddressConfigured()` and the per-component fallback UI).
 */
export const TOKEN_ADDRESS = RAW_ADDR as `0x${string}`;

/**
 * isTokenAddressConfigured — true iff the env var contains a 0x-prefixed
 * 20-byte hex address. Components branch on this to render a helpful
 * "set NEXT_PUBLIC_CONTRACT_ADDRESS" message instead of submitting a tx
 * to the zero address.
 */
export function isTokenAddressConfigured(): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(RAW_ADDR);
}

/**
 * Etherscan link for the token contract — used in the Hero badge and tx-success
 * toasts. Always returns a usable Sepolia URL even if the address is unset
 * (consumers should hide the link when `!isTokenAddressConfigured()`).
 */
export function tokenEtherscanUrl(): string {
  return `https://sepolia.etherscan.io/address/${RAW_ADDR}`;
}

/**
 * Sepolia tx-hash explorer URL helper for toast deep-links.
 */
export function txEtherscanUrl(hash: string): string {
  return `https://sepolia.etherscan.io/tx/${hash}`;
}

/**
 * MISSING_ADDRESS_HELP — copy used by components when the env var is unset.
 * Single source so the message stays consistent across BalanceCard, MintButton,
 * TransferForm.
 */
export const MISSING_ADDRESS_HELP =
  "Set NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local (or run /zama-deploy).";

/**
 * Token decimals — matches OZ ERC7984 default (6). Hard-coded to avoid a
 * round-trip read on every render; if the contract is re-deployed with a
 * different `decimals()`, update this constant.
 */
export const TOKEN_DECIMALS = 6;
export const TOKEN_SYMBOL = "cDEMO";
