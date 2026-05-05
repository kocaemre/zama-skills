import { Wallet } from "lucide-react";
import { useReadContract } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/Card";
import { HandleReveal } from "@/ui/HandleReveal";

interface BalancePanelProps {
  contractAddress: `0x${string}`;
  abi: readonly unknown[];
  signer: `0x${string}`;
}

export function BalancePanel({ contractAddress, abi, signer }: BalancePanelProps): JSX.Element {
  const { data: handle, refetch } = useReadContract({
    address: contractAddress,
    abi,
    functionName: "confidentialBalanceOf",
    args: [signer],
  });
  const handleStr = typeof handle === "string" ? handle : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          My confidential balance
        </CardTitle>
        <CardDescription>
          Stored on-chain as an encrypted handle. Only you can decrypt it via the relayer SDK.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <HandleReveal
          handle={handleStr}
          contractAddress={contractAddress}
          onRefresh={() => void refetch()}
          unit="tokens"
        />
      </CardContent>
    </Card>
  );
}
