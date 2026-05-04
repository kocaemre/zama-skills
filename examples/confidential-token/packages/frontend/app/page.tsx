"use client";

import dynamic from "next/dynamic";

const Hero = dynamic(() => import("@/components/Hero").then((m) => m.Hero), { ssr: false });
const Connect = dynamic(() => import("@/components/Connect").then((m) => m.Connect), { ssr: false });
const BalanceCard = dynamic(() => import("@/components/BalanceCard").then((m) => m.BalanceCard), { ssr: false });
const MintButton = dynamic(() => import("@/components/MintButton").then((m) => m.MintButton), { ssr: false });
const TransferForm = dynamic(() => import("@/components/TransferForm").then((m) => m.TransferForm), { ssr: false });

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
