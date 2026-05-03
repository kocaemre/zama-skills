"use client";

import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@rainbow-me/rainbowkit/styles.css";

import { config, SEPOLIA_CHAIN_ID } from "@/lib/wagmi";

export function Providers({ children }: { children: React.ReactNode }) {
  // QueryClient must be stable across renders — instantiate once via useState.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#FFD500",
            accentColorForeground: "#0A0A0A",
            borderRadius: "medium",
          })}
          initialChain={SEPOLIA_CHAIN_ID}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
