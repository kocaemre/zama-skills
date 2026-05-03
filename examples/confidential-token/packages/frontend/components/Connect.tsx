"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

/**
 * Connect — thin wrapper around RainbowKit's ConnectButton so the rest of
 * the app does not need to import the RainbowKit surface directly. Keeps
 * Plan 03's hero / header free to swap in a custom variant later.
 */
export function Connect() {
  return <ConnectButton showBalance={false} chainStatus="icon" />;
}
