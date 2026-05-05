import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TxStatusProps {
  hash: `0x${string}` | undefined;
  isPending: boolean;
  isMining: boolean;
  isSuccess: boolean;
  error?: { message?: string } | null;
  /** Sepolia by default — pass an explorer base if non-Sepolia. */
  explorer?: string;
  className?: string;
}

const DEFAULT_EXPLORER = "https://sepolia.etherscan.io";

export function TxStatus({
  hash,
  isPending,
  isMining,
  isSuccess,
  error,
  explorer = DEFAULT_EXPLORER,
  className,
}: TxStatusProps): JSX.Element | null {
  if (!hash && !isPending && !error) return null;

  return (
    <div className={cn("text-sm flex items-center gap-2 mt-3 animate-fade-in", className)}>
      {isPending && !hash && (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Sign in wallet…
        </span>
      )}
      {hash && isMining && (
        <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Mining…
        </span>
      )}
      {hash && isSuccess && (
        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Confirmed
        </span>
      )}
      {hash && (
        <a
          href={`${explorer}/tx/${hash}`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-xs font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          {hash.slice(0, 8)}…{hash.slice(-4)}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {error && (
        <span className="flex items-center gap-1.5 text-destructive max-w-full truncate">
          <XCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate text-xs">{error.message ?? "tx failed"}</span>
        </span>
      )}
    </div>
  );
}
