import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// @zama-fhe/relayer-sdk/web uses WebAssembly threads → SharedArrayBuffer →
// requires Cross-Origin Isolation. Without these headers initSDK() fails
// silently and every downstream getFhevmInstance() call throws "no cached
// instance" / "Invalid public or private key".
//
// COOP=same-origin (strict) → enables crossOriginIsolated=true → SAB on.
// COEP=credentialless → relaxes CORP requirement so wallet/icon assets load
// without CORP headers (Chrome 96+, FF 117+).
//
// Coinbase Smart Wallet logs a warning under strict COOP but degrades
// gracefully — MetaMask + WalletConnect still work.
const coopCoepHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
};

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  server: { port: 5173, headers: coopCoepHeaders },
  preview: { headers: coopCoepHeaders },
});
