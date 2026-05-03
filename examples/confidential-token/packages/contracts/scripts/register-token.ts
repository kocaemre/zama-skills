// Deferred — DO NOT run from /zama-init. /zama-deploy invokes this after the
// Sepolia deploy step succeeds.
//
// Purpose: register the freshly-deployed confidential token with Zama's
//          Confidential Token Registry on Sepolia. The registry contract
//          address is intentionally NOT pinned here — fetch it live from:
//          https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia
//
// This script uses ethers v6 only — no deprecated client-SDK dependencies.

import { ethers } from "ethers";

/**
 * Register a deployed confidential token with Zama's Confidential Token Registry.
 *
 * @param tokenAddress  Address of the deployed `Token.sol` contract on Sepolia.
 * @param signer        Ethers v6 signer authorised by the token's owner.
 *
 * TODO(/zama-deploy): real implementation lives in Phase 4. This scaffold
 * documents the call shape only.
 */
export async function registerToken(tokenAddress: string, signer: ethers.Signer): Promise<string> {
  if (!ethers.isAddress(tokenAddress)) {
    throw new Error(`registerToken: invalid token address ${tokenAddress}`);
  }

  // 1. Resolve the Confidential Token Registry address LIVE from Zama docs.
  //    DO NOT hardcode — addresses are updated periodically.
  //    Implementation deferred to /zama-deploy (Phase 4).
  const registryAddress: string = await resolveRegistryAddress();

  // 2. Minimal registry ABI surface — verify against live docs at call time.
  const registryAbi = [
    "function register(address token) external returns (bool)",
  ];

  const registry = new ethers.Contract(registryAddress, registryAbi, signer);
  const tx = await registry.register(tokenAddress);
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

/**
 * TODO(/zama-deploy): fetch registry address from
 * https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia at
 * runtime via WebFetch (or an equivalent verified source). Throws until then.
 */
async function resolveRegistryAddress(): Promise<string> {
  throw new Error(
    "resolveRegistryAddress: not implemented. /zama-deploy will resolve the " +
      "Confidential Token Registry address live from " +
      "https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia",
  );
}
