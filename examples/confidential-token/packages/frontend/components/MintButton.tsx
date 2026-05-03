"use client";

// MintButton — faucet UX. One click mints 100 cDEMO to the connected wallet
// via the public `mint(uint64)` faucet on Token.sol (capped at FAUCET_CAP
// per call). Designed in 21st.dev visual idiom: oversized yellow CTA, soft
// pulse animation, disabled state when no wallet / no address.
//
// Toast lifecycle (sonner):
//   submit  → loading toast "Minting…"
//   hash    → success toast with Etherscan deep-link
//   confirm → success toast "100 cDEMO minted to you" + invalidate balance
//   error   → error toast with shortMessage

import { useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Coins, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TOKEN_ABI,
  TOKEN_ADDRESS,
  TOKEN_DECIMALS,
  TOKEN_SYMBOL,
  isTokenAddressConfigured,
  MISSING_ADDRESS_HELP,
  txEtherscanUrl,
} from "@/lib/contract";

// 100 token-units in cleartext (uint64) — `100 * 10^decimals`.
const FAUCET_AMOUNT = 100n * 10n ** BigInt(TOKEN_DECIMALS);

export function MintButton() {
  const { isConnected } = useAccount();
  const queryClient = useQueryClient();
  const addressConfigured = isTokenAddressConfigured();

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  // Pending toast — fires when the wallet popup opens.
  useEffect(() => {
    if (!isPending) return;
    const id = toast.loading("Minting… approve the tx in your wallet.");
    return () => toast.dismiss(id);
  }, [isPending]);

  // Hash toast — fires once the wallet returns a tx hash (submitted to mempool).
  useEffect(() => {
    if (!hash) return;
    toast.success("Mint tx submitted", {
      description: (
        <a
          href={txEtherscanUrl(hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          View on Etherscan
        </a>
      ),
    });
  }, [hash]);

  // Confirmed toast + balance invalidation.
  useEffect(() => {
    if (!isConfirmed) return;
    toast.success(`100 ${TOKEN_SYMBOL} minted to you`, {
      description: "Your encrypted balance has been updated.",
    });
    void queryClient.invalidateQueries({ queryKey: ["readContract"] });
    reset();
  }, [isConfirmed, queryClient, reset]);

  // Error toast.
  useEffect(() => {
    if (!error) return;
    const msg =
      (error as { shortMessage?: string }).shortMessage ?? error.message;
    toast.error(msg);
  }, [error]);

  const onClick = () => {
    if (!addressConfigured) return;
    writeContract({
      address: TOKEN_ADDRESS,
      abi: TOKEN_ABI,
      functionName: "mint",
      args: [FAUCET_AMOUNT],
    });
  };

  const busy = isPending || isConfirming;
  const disabled = !isConnected || !addressConfigured || busy;

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Coins className="h-4 w-4" />
          Faucet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          onClick={onClick}
          disabled={disabled}
          className="group relative h-14 w-full bg-zama-yellow text-base font-semibold text-zama-black transition-all hover:bg-zama-yellow/90 hover:shadow-[0_0_24px_-4px_rgba(255,213,0,0.6)] disabled:opacity-50 disabled:hover:shadow-none"
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {isConfirming ? "Confirming…" : "Awaiting wallet…"}
            </>
          ) : (
            <>
              <Coins className="mr-2 h-5 w-5" />
              Mint 100 {TOKEN_SYMBOL} to me
            </>
          )}
          {!busy && !disabled && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-zama-yellow/30 transition-opacity animate-pulse"
            />
          )}
        </Button>
        {!addressConfigured && (
          <p className="text-xs text-muted-foreground">{MISSING_ADDRESS_HELP}</p>
        )}
        {!isConnected && addressConfigured && (
          <p className="text-xs text-muted-foreground">
            Connect a wallet to mint.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
