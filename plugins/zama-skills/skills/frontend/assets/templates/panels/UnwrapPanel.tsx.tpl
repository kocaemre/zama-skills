import { useState } from "react";
import { ArrowUpFromLine } from "lucide-react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Button } from "@/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/Card";
import { Input, Label } from "@/ui/Input";
import { TxStatus } from "@/ui/TxStatus";
import { EncryptedInput } from "@/components/EncryptedInput";

interface UnwrapPanelProps {
  contractAddress: `0x${string}`;
  abi: readonly unknown[];
  signer: `0x${string}`;
}

export function UnwrapPanel({ contractAddress, abi, signer }: UnwrapPanelProps): JSX.Element {
  const [recipient, setRecipient] = useState<string>(signer);
  const [enc, setEnc] = useState<{ handle: `0x${string}`; inputProof: `0x${string}` } | null>(null);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash });

  const submit = (): void => {
    if (!enc) return;
    // ERC7984ERC20Wrapper.unwrap(address to, euint64 amount, bytes proof) →
    // emits an async decrypt request, ERC-20 actually transfers out once the
    // KMS finalizes the decryption (a few blocks later on Sepolia).
    writeContract({
      address: contractAddress,
      abi,
      functionName: "unwrap",
      args: [recipient as `0x${string}`, enc.handle, enc.inputProof],
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowUpFromLine className="h-4 w-4 text-primary" />
          Unwrap ERC-7984 → ERC-20
        </CardTitle>
        <CardDescription>
          Schedules an async KMS decryption — underlying ERC-20 lands in the recipient a few blocks
          after the tx confirms.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="unwrap-to">Recipient</Label>
          <Input
            id="unwrap-to"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x…"
          />
        </div>
        <div>
          <Label htmlFor="unwrap-amount">Amount (encrypted euint64)</Label>
          <EncryptedInput
            contractAddress={contractAddress}
            signerAddress={signer}
            type="euint64"
            placeholder="amount to unwrap"
            onEncrypted={setEnc}
          />
        </div>
        <Button onClick={submit} disabled={!enc || isPending || isMining}>
          Unwrap
        </Button>
        <TxStatus
          hash={hash}
          isPending={isPending}
          isMining={isMining}
          isSuccess={isSuccess}
          error={error}
        />
      </CardContent>
    </Card>
  );
}
