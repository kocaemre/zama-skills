import { Hero } from "@/components/Hero";
import { Connect } from "@/components/Connect";
import { BalanceCard } from "@/components/BalanceCard";
import { MintButton } from "@/components/MintButton";
import { TransferForm } from "@/components/TransferForm";

// Disable static prerender — wagmi + RainbowKit's WalletConnect connector
// touches `indexedDB` / `window` at module init, which is not available in
// the Next.js server runtime. `force-dynamic` defers rendering to the
// client, which is fine for a single-page dApp.
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Hero />
      <div className="container mx-auto grid gap-6 px-4 py-8 md:grid-cols-2">
        <div className="space-y-6">
          <Connect />
          <BalanceCard />
        </div>
        <div className="space-y-6">
          <MintButton />
          <TransferForm />
        </div>
      </div>
    </main>
  );
}
