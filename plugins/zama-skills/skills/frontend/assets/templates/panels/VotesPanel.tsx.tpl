import { Gauge } from "lucide-react";
import { useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Button } from "@/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/Card";
import { TxStatus } from "@/ui/TxStatus";
import { HandleReveal } from "@/ui/HandleReveal";

interface VotesPanelProps {
  contractAddress: `0x${string}`;
  abi: readonly unknown[];
  signer: `0x${string}`;
}

export function VotesPanel({ contractAddress, abi, signer }: VotesPanelProps): JSX.Element {
  const { data: votesHandle, refetch } = useReadContract({
    address: contractAddress,
    abi,
    functionName: "getVotes",
    args: [signer],
  });
  const handleStr = typeof votesHandle === "string" ? votesHandle : null;

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash });

  const grantAccess = (): void => {
    if (!handleStr) return;
    writeContract({
      address: contractAddress,
      abi,
      functionName: "getHandleAllowance",
      args: [handleStr as `0x${string}`, signer, true],
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          My voting power
        </CardTitle>
        <CardDescription>
          Vote handles need an explicit ACL grant before you can decrypt them. Grant once per new
          handle, then reveal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={grantAccess} disabled={!handleStr || isPending || isMining}>
            Grant ACL access
          </Button>
        </div>
        <TxStatus
          hash={hash}
          isPending={isPending}
          isMining={isMining}
          isSuccess={isSuccess}
          error={error}
        />
        <HandleReveal
          handle={handleStr}
          contractAddress={contractAddress}
          onRefresh={() => void refetch()}
          unit="votes"
        />
      </CardContent>
    </Card>
  );
}
