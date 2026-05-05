import { useState } from "react";
import { Send } from "lucide-react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Button } from "@/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/Card";
import { Input, Label } from "@/ui/Input";
import { TxStatus } from "@/ui/TxStatus";
import { EncryptedInput } from "@/components/EncryptedInput";

interface TransferPanelProps {
  contractAddress: `0x${string}`;
  abi: readonly unknown[];
  signer: `0x${string}`;
}

export function TransferPanel({ contractAddress, abi, signer }: TransferPanelProps): JSX.Element {
  const [recipient, setRecipient] = useState<string>("");
  const [enc, setEnc] = useState<{ handle: `0x${string}`; inputProof: `0x${string}` } | null>(null);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash });

  const submit = (): void => {
    if (!enc || !recipient) return;
    writeContract({
      address: contractAddress,
      abi,
      // ERC-7984 signature: confidentialTransfer(address,euint64,bytes)
      functionName: "confidentialTransfer",
      args: [recipient as `0x${string}`, enc.handle, enc.inputProof],
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-4 w-4 text-primary" />
          Confidential transfer
        </CardTitle>
        <CardDescription>
          Recipient sees a new encrypted handle for their balance — neither amount nor running total
          ever leaks on-chain.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="xfer-to">Recipient</Label>
          <Input
            id="xfer-to"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x… (must be different from sender)"
          />
        </div>
        <div>
          <Label htmlFor="xfer-amount">Amount (encrypted euint64)</Label>
          <EncryptedInput
            contractAddress={contractAddress}
            signerAddress={signer}
            type="euint64"
            placeholder="amount"
            onEncrypted={setEnc}
          />
        </div>
        <Button
          onClick={submit}
          disabled={!enc || !recipient || isPending || isMining}
          className="w-full sm:w-auto"
        >
          Transfer
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
