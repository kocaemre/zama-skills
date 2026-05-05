import { Copy, Lock, LogOut, Wallet } from "lucide-react";
import { useState } from "react";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { shortAddr } from "@/lib/utils";

interface HeaderProps {
  title: string;
  contractAddress: `0x${string}`;
}

export function Header({ title, contractAddress }: HeaderProps): JSX.Element {
  const { isConnected, address } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [copied, setCopied] = useState(false);

  const onCorrectChain = chainId === sepolia.id;

  const copyAddr = (): void => {
    if (!address) return;
    void navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <header className="border-b border-border/40 backdrop-blur-md bg-background/60 sticky top-0 z-10">
      <div className="container flex h-14 items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-semibold text-sm md:text-base">
          <Lock className="h-4 w-4 text-primary shrink-0" />
          <span className="truncate">{title}</span>
        </div>

        <div className="flex items-center gap-2">
          {isConnected && (
            <Badge variant={onCorrectChain ? "success" : "warning"} className="hidden sm:inline-flex">
              <span
                className={
                  onCorrectChain
                    ? "h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-ring"
                    : "h-1.5 w-1.5 rounded-full bg-amber-500"
                }
              />
              {onCorrectChain ? "Sepolia" : `chain ${chainId}`}
            </Badge>
          )}

          {!isConnected ? (
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => {
                const connector = connectors[0];
                if (connector) connect({ connector });
              }}
            >
              <Wallet className="h-3.5 w-3.5" />
              {isPending ? "Connecting…" : "Connect"}
            </Button>
          ) : (
            <>
              {!onCorrectChain && (
                <Button size="sm" variant="outline" onClick={() => switchChain({ chainId: sepolia.id })}>
                  Switch to Sepolia
                </Button>
              )}
              <button
                onClick={copyAddr}
                className="text-xs font-mono px-2 py-1 rounded-md bg-muted hover:bg-accent transition-colors flex items-center gap-1.5"
                title="Copy address"
              >
                {shortAddr(address)}
                <Copy className="h-3 w-3 opacity-60" />
                {copied && <span className="text-emerald-600 dark:text-emerald-400">copied</span>}
              </button>
              <Button size="icon" variant="ghost" onClick={() => disconnect()} title="Disconnect">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="container pb-2 flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
        <span>contract:</span>
        <a
          href={`https://sepolia.etherscan.io/address/${contractAddress}`}
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground"
        >
          {shortAddr(contractAddress)}
        </a>
      </div>
    </header>
  );
}
