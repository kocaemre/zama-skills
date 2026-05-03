/**
 * register-with-registry.ts — Register a deployed confidential token with
 * Zama's Wrappers Registry on Sepolia.
 *
 * IMPORTANT: The Sepolia "Wrappers Registry" is owner-only (per Zama docs:
 * "All administrative actions are restricted to the registry owner"). It
 * also expects an ERC-20 ↔ ERC-7984-wrapper *pair*. Our standalone Token
 * contract is an ERC-7984 (NOT a wrapper around an ERC-20), so it cannot
 * be registered with this registry by an arbitrary deployer.
 *
 * The script attempts the call (so the workflow is documented and ready to
 * succeed if/when Zama publishes a permissionless registry, or if the
 * deployer is the registry owner), and gracefully logs+skips on revert
 * rather than failing the whole deploy.
 *
 * Registry source-of-truth address: fetched live via
 *   scripts/lib/zama-addresses.ts (NEVER pinned).
 */
import { ethers } from "ethers";

import { getZamaAddresses } from "./lib/zama-addresses";

export interface RegisterResult {
  attempted: true;
  registry: string;
  /** Present when the tx landed on-chain. */
  txHash?: string;
  /** Present when registration was already done or was skipped. */
  skippedReason?: string;
}

const REGISTRY_ABI = [
  // owner-only registration: pair an ERC-20 with its ERC-7984 wrapper.
  "function registerConfidentialToken(address erc20, address confidentialWrapper) external",
  // read paths (used to detect prior registration):
  "function getTokenAddress(address confidentialWrapper) external view returns (bool isValid, address token)",
];

export async function registerWithRegistry(
  signer: ethers.Signer,
  tokenAddress: string,
  underlyingErc20Address?: string,
): Promise<RegisterResult> {
  const addrs = await getZamaAddresses();
  const registryAddress = addrs.WrappersRegistry;
  if (!registryAddress) {
    return {
      attempted: true,
      registry: "(unknown)",
      skippedReason: "Wrappers Registry address missing from live docs fetch",
    };
  }

  const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, signer) as unknown as {
    getTokenAddress: (wrapper: string) => Promise<[boolean, string]>;
    registerConfidentialToken: (erc20: string, wrapper: string) => Promise<{ wait: () => Promise<{ hash: string } | null>; hash: string }>;
  };

  // Already registered? (Read fails gracefully if call reverts.)
  try {
    const [isValid, existing] = await registry.getTokenAddress(tokenAddress);
    if (existing && existing !== ethers.ZeroAddress) {
      return {
        attempted: true,
        registry: registryAddress,
        skippedReason: `Already registered (isValid=${isValid}, underlying=${existing})`,
      };
    }
  } catch {
    // ignore — registry may not expose this exact view
  }

  if (!underlyingErc20Address) {
    return {
      attempted: true,
      registry: registryAddress,
      skippedReason:
        "Token is a standalone ERC-7984 (no underlying ERC-20). Wrappers Registry expects a token+wrapper pair — skipping.",
    };
  }

  try {
    const tx = await registry.registerConfidentialToken(
      underlyingErc20Address,
      tokenAddress,
    );
    const receipt = await tx.wait();
    return {
      attempted: true,
      registry: registryAddress,
      txHash: receipt?.hash ?? tx.hash,
    };
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    return {
      attempted: true,
      registry: registryAddress,
      skippedReason: `Registry call reverted (likely: not registry owner, or interface mismatch): ${msg.split("\n")[0]}`,
    };
  }
}
