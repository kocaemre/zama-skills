# Demo Video Script — 2-3 minutes, voice-over, English

Target: YouTube unlisted, embedded in root README under "Watch the demo".

---

## Production checklist

| Item | Setting |
|------|---------|
| Duration | 2:30 (target), 3:00 (max) |
| Resolution | 1920×1080 (1080p) |
| Frame rate | 30 fps |
| Audio | Mono voice-over, 48 kHz, AAC; ambient noise <-50 dB |
| Format | MP4 (H.264 + AAC) |
| Hosting | YouTube unlisted; copy share link into README |

## Tools (Mac)

- **Screen recording**: QuickTime Player (built-in) → File > New Screen Recording. Or [OBS Studio](https://obsproject.com) (free) for higher control.
- **Microphone**: Built-in MacBook mic works for unlisted demo; AirPods improve consistency. Avoid kitchen/echo.
- **Editing**: iMovie (built-in, free) for cuts + voice-over re-takes. DaVinci Resolve if you want polish.
- **Upload**: youtube.com/upload → Visibility = **Unlisted** → copy share URL.

## Recording flow

1. Rehearse the screen actions silently once — get muscle memory for the timing.
2. Record screen + voice in one take if you can hold it; otherwise record screen first, then voice-over in iMovie.
3. Cut dead air; keep terminal output legible (don't scroll fast — viewers freeze-frame).
4. Add a 1-second title card at the start with the GitHub URL.

---

## Script (read this aloud — total ~340 words = 2:30 at 135 wpm)

### [0:00 — 0:15] Hook + GitHub URL title card

> Most developers want to ship privacy-preserving smart contracts but stop the moment they hit fully homomorphic encryption. Today I'll show you how to scaffold, deploy, and verify a confidential ERC-7984 token in three minutes — without writing a single line of FHE boilerplate by hand.

**Screen**: Title card → `github.com/kocaemre/zama-skills` overlay.

### [0:15 — 0:30] Install (one line)

> One command pulls everything in. From an empty directory, I run the marketplace install in Claude Code.

**Screen**: Type in Claude Code:
```
/plugin marketplace add github.com/kocaemre/zama-skills
/plugin install zama-skills@zama-skills
```
Show the autocomplete listing **8 skills**: init, contract, test, deploy, frontend, design, audit, debug.

### [0:30 — 1:00] /zama-design (the planning skill)

> Before scaffolding, I describe what I want. The design skill queries the live Zama documentation through context7 — no hallucinated APIs — and emits a `DESIGN.md` with my contract architecture, ACL strategy, and UI wireframe.

**Screen**: Run `/zama-design`, type "confidential ERC-7984 token, anyone can mint a small faucet, balances stay encrypted, transfers happen confidentially". Show the generated DESIGN.md briefly.

### [1:00 — 1:30] /zama-init + /zama-contract (chained scaffolding)

> The skills chain automatically. Init scaffolds a pnpm monorepo with hardhat + Next.js. Contract reads the design and writes a real OpenZeppelin ERC-7984 token with auto-injected ACL grants and zero cleartext leaks.

**Screen**: Run `/zama-init`, then `/zama-contract`. Show the generated `Token.sol` — point at the `FHE.allowThis` line and the OZ import.

### [1:30 — 2:00] /zama-deploy (real Sepolia)

> Deploy goes to Sepolia, verifies on Etherscan, and registers the token. The whole flow is one command.

**Screen**: Run `/zama-deploy` (or show the existing deploy log). Open Etherscan: `0x04Bd105DE7a5D3297c3747cef90ac8b760136896` — point at the green "Verified" badge.

### [2:00 — 2:30] Live dApp on Vercel

> The frontend is already deployed. Connect MetaMask, mint 100 tokens, and decrypt your encrypted balance through the Zama relayer. Notice the four UX states — idle, requesting, decrypted, error — built into every confidential interaction.

**Screen**: Open https://zama-skills.vercel.app, connect wallet, click "Mint 100 cDEMO", click the balance card to decrypt. Show the spinner state, then the revealed number.

### [2:30 — end] Outro

> Eight skills, one marketplace install, one verified contract on chain. Star the repo, install it, and ship your own confidential dApp this afternoon.

**Screen**: GitHub repo URL again, with a quick "8 SKILLS" overlay listing them. Fade out.

---

## Common pitfalls

- **Wallet popup spam**: pre-approve sites in MetaMask before recording; reject prompts kill the flow.
- **Sepolia ETH**: ensure deploy wallet `0xFa29…37e7` still has gas before live deploy demo (currently ~0.298 ETH).
- **Latency on relayer decrypt**: 3-8 seconds is normal — let the spinner play; don't cut.
- **Dark mode**: macOS dark + dApp dark + terminal dark = visual consistency.
