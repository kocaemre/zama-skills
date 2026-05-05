import { Eye, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/ui/Button";
import { useDecrypted } from "@/hooks/useDecrypted";
import { shortHandle } from "@/lib/utils";

interface HandleRevealProps {
  /** Encrypted handle (0x…) returned by a contract `confidential*` getter, or null while loading. */
  handle: string | null;
  contractAddress: `0x${string}`;
  onRefresh?: () => void;
  /** Override the unit suffix shown next to the decrypted value ("tokens", "votes", …). */
  unit?: string;
  /** Decimals to format the bigint with — leave undefined to render the raw bigint. */
  decimals?: number;
}

function formatUnits(v: bigint, decimals: number): string {
  if (decimals <= 0) return v.toString();
  const s = v.toString().padStart(decimals + 1, "0");
  const i = s.length - decimals;
  const intPart = s.slice(0, i);
  const fracPart = s.slice(i).replace(/0+$/, "");
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}

export function HandleReveal({
  handle,
  contractAddress,
  onRefresh,
  unit,
  decimals,
}: HandleRevealProps): JSX.Element {
  const decrypt = useDecrypted<bigint>({ handle, contractAddress });

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-muted/50 px-3 py-2 text-xs font-mono text-muted-foreground flex items-center justify-between">
        <span>handle: {shortHandle(handle)}</span>
        {onRefresh && (
          <button onClick={onRefresh} className="hover:text-foreground" title="Re-read handle">
            <RefreshCw className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={decrypt.request}
          disabled={!handle || decrypt.status === "requesting"}
        >
          {decrypt.status === "requesting" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Awaiting relayer (5–10s)…
            </>
          ) : (
            <>
              <Eye className="h-3.5 w-3.5" />
              Reveal
            </>
          )}
        </Button>

        {decrypt.status === "decrypted" && (
          <span className="text-2xl font-mono font-semibold tracking-tight tabular-nums animate-fade-in">
            {decimals !== undefined
              ? formatUnits(decrypt.value ?? 0n, decimals)
              : (decrypt.value ?? 0n).toString()}
            {unit && <span className="text-sm text-muted-foreground ml-1.5 font-normal">{unit}</span>}
          </span>
        )}
      </div>

      {decrypt.status === "error" && (
        <p className="text-xs text-destructive">decrypt failed: {decrypt.error?.message}</p>
      )}
    </div>
  );
}
