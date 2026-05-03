// Sepolia-only wagmi v2 config — single source of truth for both providers
// and any direct viem clients. RainbowKit's `getDefaultConfig` wires the
// standard connector set (injected, MetaMask SDK, WalletConnect, Coinbase)
// and returns a wagmi `Config` with SSR cookie storage.
//
// ENV: NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required for WalletConnect to
// initialise — at runtime, missing projectId throws inside the modal.
// NEXT_PUBLIC_SEPOLIA_RPC overrides the public Sepolia RPC; falls back to
// viem's default chain RPC if unset.

import { http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

export const SEPOLIA_CHAIN_ID = sepolia.id; // 11155111

export const config = getDefaultConfig({
  appName: "Confidential Demo Token",
  // RainbowKit throws at module init when projectId is empty, which breaks
  // `next build`. Fall back to a sentinel so the build succeeds; runtime
  // WalletConnect will simply fail until users set a real projectId in
  // `.env.local` or Vercel env vars (documented in `.env.local.example`).
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
    "REPLACE_WITH_WALLETCONNECT_PROJECT_ID",
  chains: [sepolia],
  ssr: true,
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC),
  },
});
