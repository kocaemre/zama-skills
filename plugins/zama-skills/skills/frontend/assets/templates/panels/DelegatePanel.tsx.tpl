import { useEffect } from "react";
import { Vote } from "lucide-react";
import { useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Button } from "@/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/Card";
import { TxStatus } from "@/ui/TxStatus";
import { shortAddr } from "@/lib/utils";

interface DelegatePanelProps {
  contractAddress: `0x${string}`;
  abi: readonly unknown[];
  signer: `0x${string}`;
}

export function DelegatePanel({ contractAddress, abi, signer }: DelegatePanelProps): JSX.Element {
  const { data: delegatee, refetch } = useReadContract({
    address: contractAddress,
    abi,
    functionName: "delegates",
    args: [signer],
  });
  const isSelfDelegated =
    typeof delegatee === "string" && delegatee.toLowerCase() === signer.toLowerCase();

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) void refetch();
  }, [isSuccess, refetch]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Vote className="h-4 w-4 text-primary" />
          Activate voting power
        </CardTitle>
        <CardDescription>
          ERC7984Votes only checkpoints voting weight after you delegate. Delegate to yourself once
          to activate your vote.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm">
          <span className="text-muted-foreground">current delegatee: </span>
          <code className="font-mono">
            {typeof delegatee === "string" ? shortAddr(delegatee) : "loading…"}
          </code>
          {isSelfDelegated && (
            <span className="ml-2 text-emerald-600 dark:text-emerald-400">✓ active</span>
          )}
        </div>
        <Button
          disabled={isSelfDelegated || isPending || isMining}
          onClick={() =>
            writeContract({
              address: contractAddress,
              abi,
              functionName: "delegate",
              args: [signer],
            })
          }
        >
          {isSelfDelegated ? "Already delegated" : "Delegate to self"}
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
