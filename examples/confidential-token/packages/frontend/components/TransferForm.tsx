"use client";

// TransferForm — confidential transfer UX. Recipient + amount inputs.
// On amount blur the EncryptedInput primitive (from /zama-frontend output)
// asks the relayer to encrypt the cleartext value into a (handle, inputProof)
// pair bound to (this contract, this signer). The form then submits a
// `confidentialTransfer(to, handle, inputProof)` write via wagmi.
//
// Design idiom: 21st.dev compact card — single column, accent-coloured
// submit, inline red helper text on validation failure.

import { useEffect, useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { isAddress } from "viem";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EncryptedInput } from "@zama/components/EncryptedInput";
import {
  TOKEN_ABI,
  TOKEN_ADDRESS,
  TOKEN_DECIMALS,
  TOKEN_SYMBOL,
  isTokenAddressConfigured,
  MISSING_ADDRESS_HELP,
  txEtherscanUrl,
} from "@/lib/contract";

interface EncryptedPayload {
  handle: string;
  inputProof: string;
}

export function TransferForm() {
  const { address, isConnected } = useAccount();
  const addressConfigured = isTokenAddressConfigured();
  const queryClient = useQueryClient();

  const [to, setTo] = useState<string>("");
  const [encrypted, setEncrypted] = useState<EncryptedPayload | null>(null);

  const { writeContract, data: hash, isPending, error, reset } =
    useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  const toIsValid = to.length === 0 || isAddress(to);
  const formReady =
    isConnected &&
    addressConfigured &&
    isAddress(to) &&
    encrypted !== null &&
    !isPending &&
    !isConfirming;

  // Toast lifecycle (mirrors MintButton).
  useEffect(() => {
    if (!isPending) return;
    const id = toast.loading("Transferring… approve the tx in your wallet.");
    return () => toast.dismiss(id);
  }, [isPending]);

  useEffect(() => {
    if (!hash) return;
    toast.success("Transfer tx submitted", {
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

  useEffect(() => {
    if (!isConfirmed) return;
    toast.success("Transfer confirmed", {
      description: `Sent ${TOKEN_SYMBOL} to ${to.slice(0, 6)}…${to.slice(-4)}.`,
    });
    void queryClient.invalidateQueries({ queryKey: ["readContract"] });
    setTo("");
    setEncrypted(null);
    reset();
  }, [isConfirmed, queryClient, reset, to]);

  useEffect(() => {
    if (!error) return;
    const msg =
      (error as { shortMessage?: string }).shortMessage ?? error.message;
    toast.error(msg);
  }, [error]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formReady || !encrypted) return;
    writeContract({
      address: TOKEN_ADDRESS,
      abi: TOKEN_ABI,
      functionName: "confidentialTransfer",
      args: [
        to as `0x${string}`,
        encrypted.handle as `0x${string}`,
        encrypted.inputProof as `0x${string}`,
      ],
    });
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Send className="h-4 w-4" />
          Send confidentially
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="recipient"
              className="text-xs font-medium text-muted-foreground"
            >
              Recipient address
            </label>
            <Input
              id="recipient"
              placeholder="0x…"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              className="font-mono text-sm"
            />
            {!toIsValid && (
              <p className="text-xs text-destructive">Not a valid address.</p>
            )}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="amount"
              className="text-xs font-medium text-muted-foreground"
            >
              Amount (encrypted on blur)
            </label>
            {isConnected && addressConfigured && address ? (
              <EncryptedInput
                contractAddress={TOKEN_ADDRESS}
                signerAddress={address}
                type="euint64"
                decimals={TOKEN_DECIMALS}
                onEncrypted={(out) => setEncrypted(out)}
                placeholder="e.g. 10"
                className="encrypted-input-wrapper"
              />
            ) : (
              <Input disabled placeholder="Connect wallet to enable…" />
            )}
            {encrypted && (
              <p className="text-xs text-zama-yellow">
                ✓ Encrypted — ready to send.
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={!formReady}
            className="w-full bg-zama-yellow font-semibold text-zama-black hover:bg-zama-yellow/90 disabled:opacity-50"
          >
            {isPending || isConfirming ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isConfirming ? "Confirming…" : "Awaiting wallet…"}
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send {TOKEN_SYMBOL}
              </>
            )}
          </Button>

          {!addressConfigured && (
            <p className="text-xs text-muted-foreground">
              {MISSING_ADDRESS_HELP}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
