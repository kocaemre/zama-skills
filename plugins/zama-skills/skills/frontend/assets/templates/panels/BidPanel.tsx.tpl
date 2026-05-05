import { useState } from "react";
import { Gavel } from "lucide-react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Button } from "@/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/Card";
import { TxStatus } from "@/ui/TxStatus";
import { EncryptedInput } from "@/components/EncryptedInput";

interface BidPanelProps {
  contractAddress: `0x${string}`;
  abi: readonly unknown[];
  signer: `0x${string}`;
}

export function BidPanel({ contractAddress, abi, signer }: BidPanelProps): JSX.Element {
  const [enc, setEnc] = useState<{ handle: `0x${string}`; inputProof: `0x${string}` } | null>(null);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash });

  const submit = (): void => {
    if (!enc) return;
    // Sealed-bid auction: encrypted euint64 bid + ZK input proof. The contract
    // keeps the running max under FHE; only the winner's bid is revealed when
    // the auction closes.
    writeContract({
      address: contractAddress,
      abi,
      functionName: "bid",
      args: [enc.handle, enc.inputProof],
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gavel className="h-4 w-4 text-primary" />
          Place encrypted bid
        </CardTitle>
        <CardDescription>
          Bid amount is encrypted client-side. The contract compares all bids under FHE and reveals
          only the winner's price at close.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <EncryptedInput
          contractAddress={contractAddress}
          signerAddress={signer}
          type="euint64"
          placeholder="your bid"
          onEncrypted={setEnc}
        />
        <Button onClick={submit} disabled={!enc || isPending || isMining}>
          Submit bid
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
