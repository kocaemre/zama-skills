"use client";

// BalanceCard — the showpiece. Renders the connected user's confidential
// balance through an explicit 4-state machine driven by `useDecrypted` from
// the /zama-frontend skill output:
//
//   idle        "Click to decrypt" CTA — encrypted handle loaded but
//               plaintext not requested yet
//   requesting  Skeleton + caption "Decrypting via relayer (5–10s)…"
//   decrypted   Large numeric display + "Refresh" button
//   error       Red message + Retry
//
// Two pre-states wrap the machine for the realistic empty-flow:
//   - no wallet connected         → "Connect a wallet to view your balance"
//   - no NEXT_PUBLIC_CONTRACT_ADDRESS → MISSING_ADDRESS_HELP
//
// We never show the raw ciphertext handle to the user — only the decrypted
// number, formatted with the contract's decimals via viem's `formatUnits`.

import { useEffect, useMemo } from "react";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { Loader2, Eye, RefreshCw, AlertCircle, Lock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDecrypted } from "@zama/hooks/useDecrypted";
import { useFhevmInstance } from "@zama/lib/fhe";
import {
  TOKEN_ABI,
  TOKEN_ADDRESS,
  TOKEN_DECIMALS,
  TOKEN_SYMBOL,
  isTokenAddressConfigured,
  MISSING_ADDRESS_HELP,
} from "@/lib/contract";

export function BalanceCard() {
  const { address, isConnected } = useAccount();
  // Initialise the fhEVM instance (singleton, cached). useDecrypted's
  // getFhevmInstance() relies on this hook firing somewhere in the React tree
  // before the user requests a decrypt — without it the lookup throws
  // "no cached instance".
  useFhevmInstance();
  const addressConfigured = isTokenAddressConfigured();

  // Read the encrypted balance handle. `confidentialBalanceOf` returns a
  // bytes32 (`euint64`) that we feed to the decrypt hook on user action.
  const {
    data: handleData,
    isFetching: handleLoading,
    refetch: refetchHandle,
  } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: TOKEN_ABI,
    functionName: "confidentialBalanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(addressConfigured && isConnected && address),
    },
  });

  const handle = useMemo(() => {
    if (typeof handleData !== "string") return null;
    if (!handleData.startsWith("0x")) return null;
    // ZeroHash means "user has no encrypted entry yet" — treat as no handle.
    if (
      handleData ===
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    ) {
      return null;
    }
    return handleData;
  }, [handleData]);

  const { status, value, error, request } = useDecrypted<bigint>({
    handle,
    contractAddress: TOKEN_ADDRESS,
  });

  // When the handle changes (e.g. after a refetch following a tx confirm),
  // re-arm the decryption machine so the user can request a fresh decrypt.
  // Note: `useDecrypted` itself does not auto-reset; we rely on the user
  // pressing "Refresh" to re-request.
  useEffect(() => {
    // Side-effect placeholder for future cache invalidation hooks.
  }, [handle]);

  // ────────────────────────────────────────────────────────────────────
  // Pre-states — bail out before rendering the 4-state machine.
  // ────────────────────────────────────────────────────────────────────

  if (!addressConfigured) {
    return (
      <BalanceShell>
        <div className="flex items-start gap-3 rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-zama-yellow" />
          <span>{MISSING_ADDRESS_HELP}</span>
        </div>
      </BalanceShell>
    );
  }

  if (!isConnected || !address) {
    return (
      <BalanceShell>
        <p className="text-sm text-muted-foreground">
          Connect a wallet to view your encrypted balance.
        </p>
      </BalanceShell>
    );
  }

  if (handleLoading && !handle) {
    return (
      <BalanceShell>
        <Skeleton className="h-12 w-3/4" />
      </BalanceShell>
    );
  }

  if (handle === null) {
    return (
      <BalanceShell>
        <div className="space-y-2">
          <p className="text-3xl font-semibold text-foreground">
            0 <span className="text-base text-muted-foreground">{TOKEN_SYMBOL}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            No encrypted entry yet — mint to create one.
          </p>
        </div>
      </BalanceShell>
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // 4-state machine — `useDecrypted` drives the UX from here.
  // ────────────────────────────────────────────────────────────────────

  return (
    <BalanceShell>
      {status === "idle" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Encrypted balance — only you can read it.
          </div>
          <Button
            onClick={request}
            className="bg-zama-yellow text-zama-black hover:bg-zama-yellow/90"
          >
            <Eye className="mr-2 h-4 w-4" />
            Click to decrypt
          </Button>
        </div>
      )}

      {status === "requesting" && (
        <div className="space-y-3">
          <Skeleton className="h-12 w-3/4" />
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-zama-yellow" />
            Decrypting via relayer… (5–10s on Sepolia)
          </p>
        </div>
      )}

      {status === "decrypted" && (
        <div className="space-y-3">
          <p className="text-4xl font-bold tabular-nums text-foreground md:text-5xl">
            {value !== undefined ? formatUnits(value, TOKEN_DECIMALS) : "—"}{" "}
            <span className="text-lg font-medium text-muted-foreground">
              {TOKEN_SYMBOL}
            </span>
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void refetchHandle();
              request();
            }}
            className="text-muted-foreground hover:text-zama-yellow"
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span className="break-words">
              {error?.message ?? "Decryption failed."}
            </span>
          </div>
          <Button onClick={request} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}
    </BalanceShell>
  );
}

/**
 * BalanceShell — the dark Card chrome shared by every state. Yellow accent
 * border on hover gives a subtle interactive cue that the value is live.
 */
function BalanceShell({ children }: { children: React.ReactNode }) {
  return (
    <Card className="border-border bg-card transition-colors hover:border-zama-yellow/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Lock className="h-4 w-4" />
          Your balance
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
