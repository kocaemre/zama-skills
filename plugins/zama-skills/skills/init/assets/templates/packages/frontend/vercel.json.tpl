{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "_comment": "Cross-Origin Isolation headers — required for @zama-fhe/relayer-sdk WebAssembly threads (SharedArrayBuffer). Without these, initSDK() fails silently in production. See vite.config.ts for the dev-server equivalent.",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "credentialless" }
      ]
    }
  ]
}
