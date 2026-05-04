# Deploying this example to Vercel

> The Confidential Demo Token (cDEMO) frontend is a standard Next.js 15 app. Vercel binds to the GitHub repo via the dashboard — we deliberately do **not** ship the Vercel CLI in this project (per project decision: humans control deployment, agents control scaffolding).

## Prerequisites

- The contract is already deployed to Sepolia at [`0x04Bd105DE7a5D3297c3747cef90ac8b760136896`](https://sepolia.etherscan.io/address/0x04Bd105DE7a5D3297c3747cef90ac8b760136896#code) — you do **not** need to redeploy to use this UI.
- A Vercel account ([vercel.com/signup](https://vercel.com/signup) — free Hobby tier is fine).
- A WalletConnect Cloud project ID ([cloud.walletconnect.com](https://cloud.walletconnect.com) — free).

## One-time bind (5 minutes)

### 1. Push your fork to GitHub

```bash
git push origin main
```

### 2. Import the repo at Vercel

Open <https://vercel.com/new> → click **Import** next to your fork of this repo.

### 3. Configure the project

| Setting | Value |
| --- | --- |
| **Framework Preset** | Next.js (auto-detected) |
| **Root Directory** | `examples/confidential-token/packages/frontend` |
| **Build Command** | *(leave default — `next build`)* |
| **Output Directory** | *(leave default — `.next`)* |
| **Install Command** | *(leave default — Vercel detects pnpm workspace)* |

> **Important:** the **Root Directory** must be the path to the Next.js app inside the monorepo, **not** the repo root. Click "Edit" next to Root Directory and paste `examples/confidential-token/packages/frontend`.

### 4. Add environment variables

Under **Environment Variables**, add the four `NEXT_PUBLIC_*` variables. All four are required — leaving any blank will cause runtime errors in the browser.

| Variable | Value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | `0x04Bd105DE7a5D3297c3747cef90ac8b760136896` | Live cDEMO contract on Sepolia (from `packages/contracts/deployments/sepolia/Token.json`) |
| `NEXT_PUBLIC_SEPOLIA_RPC` | `https://ethereum-sepolia.publicnode.com` | Or your Alchemy/Infura URL. Public alternatives: `https://1rpc.io/sepolia`, `https://rpc.sepolia.org` |
| `NEXT_PUBLIC_RELAYER_URL` | `https://relayer.testnet.zama.cloud` | Zama Sepolia relayer. Verify against [docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia](https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia) periodically |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | *(your project ID)* | Get one at [cloud.walletconnect.com](https://cloud.walletconnect.com) — required by RainbowKit |

Apply each variable to all three environments: **Production**, **Preview**, **Development**.

### 5. Deploy

Click **Deploy**. First build takes ~2-3 minutes (compiling Next.js + WalletConnect bundles).

### 6. Verify the deployment

Once Vercel reports "Deployment ready":

1. Open the production URL Vercel gave you (e.g. `https://confidential-token-<hash>.vercel.app`).
2. Click **Connect Wallet** → MetaMask → switch to Sepolia.
3. Get a small amount of test ETH from a faucet ([sepoliafaucet.com](https://sepoliafaucet.com), [infura.io/faucet/sepolia](https://www.infura.io/faucet/sepolia)).
4. Click **Mint** — confirm the tx in MetaMask.
5. Watch the BalanceCard 4-state UX: `idle → encrypting → relayer-pending → revealed`.
6. Try a confidential transfer to another address — confirm the recipient can decrypt their balance.

If any step fails, check the browser console for the missing env var or RPC error and re-deploy.

## After deployment — update the URLs

Once you have the production URL, replace the `https://zama-skills.vercel.app` placeholders in two files (both are marked with `<!-- @sync:vercel-url -->`):

1. [`examples/confidential-token/README.md`](./README.md) — three occurrences (badge, Try it live link, link target)
2. [`README.md`](../../README.md) — root README "Try it live" badge

Commit those changes — they're the final step that makes EXAMPLE-03 fully met.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Build fails at `next build` with `Module not found` | pnpm workspace not detected | Set **Install Command** to `cd ../../.. && pnpm install --filter @confidential-token/frontend...` |
| "Failed to fetch" in browser console | `NEXT_PUBLIC_SEPOLIA_RPC` empty or rate-limited | Switch to a different public RPC or get an Alchemy key |
| WalletConnect modal won't open | `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` empty or wrong | Re-check the value in Vercel env vars, redeploy |
| Decrypt hangs in `relayer-pending` forever | `NEXT_PUBLIC_RELAYER_URL` wrong, or contract ACL not granted | Confirm value is `https://relayer.testnet.zama.cloud`; check contract calls `FHE.allowThis` after every state write |
| Tx reverts on Sepolia | Out of gas or stale relayer key set | Top up Sepolia ETH; redeploy contract if relayer keys rotated |

## Why Vercel binding is a manual step

Per project policy ([`.planning/phases/05-reference-example-dapp/05-CONTEXT.md`](../../.planning/phases/05-reference-example-dapp/05-CONTEXT.md)):

- **Skills scaffold; humans deploy.** The Vercel CLI is intentionally not invoked from any skill — that would couple the plugin to a hosting choice.
- **GitHub-bind is a one-click action you do once.** All subsequent `git push` events trigger Vercel previews + production deploys automatically.
- **Env var values include a contract address that should be reviewed.** Auto-pasting a contract address into a public deployment is a footgun; you should glance at it once.

---

> **Awaiting:** After binding, paste the production URL into a reply (or commit the URL replacement directly) so Phase 5 can mark EXAMPLE-03 as fully met. Reply `deferred` to push Vercel binding into Phase 6 polish.
