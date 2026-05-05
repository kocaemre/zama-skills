import { useState } from "react";
import { Coins } from "lucide-react";
import { useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Button } from "@/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/Card";
import { Input, Label } from "@/ui/Input";
import { TxStatus } from "@/ui/TxStatus";
import { EncryptedInput } from "@/components/EncryptedInput";

interface MintPanelProps {
  contractAddress: `0x${string}`;
  abi: readonly unknown[];
  signer: `0x${string}`;
}

export function MintPanel({ contractAddress, abi, signer }: MintPanelProps): JSX.Element {
  const { data: owner } = useReadContract({ address: contractAddress, abi, functionName: "owner" });
  const isOwner = typeof owner === "string" && owner.toLowerCase() === signer.toLowerCase();

  const [recipient, setRecipient] = useState<string>(signer);
  const [enc, setEnc] = useState<{ handle: `0x${string}`; inputProof: `0x${string}` } | null>(null);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash });

  const submit = (): void => {
    if (!enc) return;
    writeContract({
      address: contractAddress,
      abi,
      functionName: "mint",
      args: [recipient as `0x${string}`, enc.handle, enc.inputProof],
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-primary" />
          Mint (owner-only)
        </CardTitle>
        <CardDescription>
          Encrypt the amount client-side, then mint encrypted balance to a recipient.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isOwner ? (
          <p className="text-sm text-muted-foreground">
            Connected wallet is <strong>not</strong> the contract owner. Owner is{" "}
            <code className="text-xs">{typeof owner === "string" ? owner : "loading…"}</code>.
            Import the deployer mnemonic in <code className="text-xs">.env</code> to mint.
          </p>
        ) : (
          <>
            <div>
              <Label htmlFor="mint-recipient">Recipient</Label>
              <Input
                id="mint-recipient"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x…"
              />
            </div>
            <div>
              <Label htmlFor="mint-amount">Amount (encrypted euint64)</Label>
              <EncryptedInput
                contractAddress={contractAddress}
                signerAddress={signer}
                type="euint64"
                placeholder="e.g. 100"
                onEncrypted={setEnc}
              />
            </div>
            <Button onClick={submit} disabled={!enc || isPending || isMining}>
              Mint
            </Button>
            <TxStatus
              hash={hash}
              isPending={isPending}
              isMining={isMining}
              isSuccess={isSuccess}
              error={error}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
