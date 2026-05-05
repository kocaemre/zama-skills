import { useState } from "react";
import { ArrowDownToLine } from "lucide-react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Button } from "@/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/Card";
import { Input, Label } from "@/ui/Input";
import { TxStatus } from "@/ui/TxStatus";

interface WrapPanelProps {
  contractAddress: `0x${string}`;
  abi: readonly unknown[];
}

export function WrapPanel({ contractAddress, abi }: WrapPanelProps): JSX.Element {
  const [amount, setAmount] = useState<string>("");
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash });

  const submit = (): void => {
    if (!amount) return;
    let asBig: bigint;
    try {
      asBig = BigInt(amount.trim());
    } catch {
      return;
    }
    // ERC7984ERC20Wrapper.wrap(uint256) — caller must have first approved the
    // underlying ERC-20 transfer to the wrapper contract.
    writeContract({ address: contractAddress, abi, functionName: "wrap", args: [asBig] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowDownToLine className="h-4 w-4 text-primary" />
          Wrap ERC-20 → ERC-7984
        </CardTitle>
        <CardDescription>
          Pulls cleartext ERC-20 tokens into encrypted balance. Approve the wrapper on the
          underlying ERC-20 first.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="wrap-amount">Amount (raw uint256)</Label>
          <Input
            id="wrap-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 1000000000000000000 for 1 token (18 decimals)"
          />
        </div>
        <Button onClick={submit} disabled={!amount || isPending || isMining}>
          Wrap
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
