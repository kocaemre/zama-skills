// Hero — landing-page banner. Designed in the 21st.dev visual idiom (dark
// glass card, single bright accent, soft glow) but written by hand because
// the Magic MCP component-builder is not available in this execution
// environment. The structure (badge right-of-headline, two-column at md+,
// stacked at sm) mirrors what 21st.dev would emit for a "hero with verified
// badge" prompt.

import Link from "next/link";
import { ExternalLink, ShieldCheck } from "lucide-react";

import {
  TOKEN_ADDRESS,
  isTokenAddressConfigured,
  tokenEtherscanUrl,
} from "@/lib/contract";

function shortAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function Hero() {
  const hasAddress = isTokenAddressConfigured();

  return (
    <section className="relative isolate overflow-hidden border-b border-border bg-zama-black">
      {/* Soft yellow radial glow behind the headline — Zama brand accent. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-zama-yellow/10 blur-3xl"
      />

      <div className="container mx-auto flex flex-col gap-8 px-4 py-16 md:flex-row md:items-center md:justify-between md:py-24">
        <div className="max-w-2xl space-y-4">
          <p className="inline-flex items-center gap-2 rounded-full border border-zama-yellow/30 bg-zama-yellow/5 px-3 py-1 text-xs font-medium text-zama-yellow">
            <ShieldCheck className="h-3.5 w-3.5" />
            Powered by fhEVM
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
            Confidential ERC7984
            <span className="block text-zama-yellow">on Sepolia</span>
          </h1>
          <p className="max-w-xl text-base text-muted-foreground md:text-lg">
            Encrypted balances. Public transfers. Mint, hold, and send tokens
            whose amounts only you can read.
          </p>
        </div>

        {hasAddress ? (
          <Link
            href={tokenEtherscanUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex items-center gap-3 rounded-xl border border-zama-yellow/40 bg-zama-yellow/5 px-5 py-4 transition-all hover:border-zama-yellow/70 hover:bg-zama-yellow/10 hover:shadow-[0_0_32px_-4px_rgba(255,213,0,0.55)] focus:outline-none focus:ring-2 focus:ring-zama-yellow"
          >
            <ShieldCheck className="h-5 w-5 text-zama-yellow" />
            <div className="flex flex-col text-left">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Verified contract
              </span>
              <span className="font-mono text-sm text-foreground">
                {shortAddress(TOKEN_ADDRESS)}
              </span>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-zama-yellow" />
          </Link>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card/50 px-5 py-4 text-xs text-muted-foreground">
            Verified contract badge appears
            <br />
            after deploy (Plan 04).
          </div>
        )}
      </div>
    </section>
  );
}
