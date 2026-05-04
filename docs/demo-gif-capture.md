# Demo GIF Capture Instructions

This document tells you (the maintainer) how to record the 90-second demo GIF that lives at the top of the project README. Once recorded, drop the file at `examples/confidential-token/docs/demo.gif` and the README's `<!-- @sync:demo-gif -->` marker will pick it up — no manual edit required.

## Goal

A **60–90 second silent GIF** showing the full happy path:

1. `/plugin marketplace add github.com/kocaemre/zama-skills` in Claude Code
2. `/plugin install zama-skills@zama-skills`
3. `/zama-skills:init token` running and scaffolding the project
4. `pnpm hardhat compile` going green
5. Opening the live Vercel URL ([zama-skills.vercel.app](https://zama-skills.vercel.app)) and decrypting a confidential balance with MetaMask

**Output constraints (GitHub README inline):**

| Constraint | Limit |
|------------|-------|
| File size  | ≤ 8 MB (GitHub inline cap is 10 MB; leave headroom) |
| Frame rate | ≤ 30 fps (15–20 fps is fine for terminal-heavy footage) |
| Resolution | ≤ 1280×720 |
| Duration   | 60–90 s |
| Audio      | none (GIF format — silent) |

## Recommended tools

| Platform | Tool | Notes |
|----------|------|-------|
| macOS | [Cleanshot X](https://cleanshot.com) | Best UX, native GIF export, scroll/cursor highlight |
| macOS | [Kap](https://getkap.co) | Free, open-source, decent GIF export |
| Linux | [peek](https://github.com/phw/peek) | Lightweight GIF screen recorder |
| Cross-platform | [terminalizer](https://github.com/faressoft/terminalizer) | Best for terminal-only segments — records `.cast` then renders to GIF |
| Cross-platform | [LICEcap](https://www.cockos.com/licecap/) | Old-school, reliable, tiny output files |

For mixed terminal + browser footage on macOS, **Cleanshot X** is the recommended path. For pure terminal segments, terminalizer renders crisper text at smaller sizes.

## Capture script

Aim for these timing checkpoints. Practice once before hitting record so you don't fumble.

| Time      | Segment | What viewer sees |
|-----------|---------|------------------|
| 0:00–0:10 | Claude Code install | Type `/plugin marketplace add github.com/kocaemre/zama-skills` then `/plugin install zama-skills@zama-skills`. Wait for confirmation. |
| 0:10–0:20 | Empty dir | `mkdir my-dapp && cd my-dapp && ls` showing nothing |
| 0:20–0:50 | Init scaffold | Type `/zama-skills:init token` in Claude Code. Show the file tree growing in your editor. |
| 0:50–1:05 | Compile | `pnpm install` then `pnpm hardhat compile`. Cut filler — speed up the install with editing if needed. |
| 1:05–1:30 | Live decrypt | Cut to browser at [zama-skills.vercel.app](https://zama-skills.vercel.app). Connect MetaMask (Sepolia), click "Decrypt balance", show the cleartext appearing. |

If you overshoot 90 s, cut the install segment first (viewers can skim it).

## Output path

Save the final file at:

```
examples/confidential-token/docs/demo.gif
```

The README already references this exact path through the `<!-- @sync:demo-gif -->` marker — once the file exists, the demo image renders automatically. Do NOT rename or move it without also updating the marker comment in `README.md`.

## Optimization

Raw screen recordings are huge. Always run a final pass with [gifsicle](https://www.lcdf.org/gifsicle/):

```bash
gifsicle -O3 --lossy=80 --colors 128 demo.gif -o demo.gif
```

Tunables if still over 8 MB:

- `--colors 64` (palette reduction is the biggest win for terminal footage)
- `--scale 0.75` (drop resolution)
- `--lossy=120` (more aggressive compression)
- Drop frames: `gifsicle -U demo.gif "#0--2" -o demo.gif` (every 3rd frame)

Verify size:

```bash
ls -lh examples/confidential-token/docs/demo.gif
```

## Alternative — host as MP4 / YouTube

If you cannot get the GIF under 8 MB without losing quality:

1. Record as MP4 (1080p is fine — no GitHub inline cap on linked video)
2. Upload to YouTube as **unlisted**
3. Replace the README image with a clickable thumbnail:

```markdown
[![demo thumbnail](docs/demo-thumbnail.png)](https://www.youtube.com/watch?v=YOUR_VIDEO_ID)
```

4. Save the thumbnail at `docs/demo-thumbnail.png` (1280×720 PNG, ≤ 200 KB)
5. Update the `<!-- @sync:demo-gif -->` marker line in `README.md` to use the thumbnail+link form above.

The thumbnail path is the only manual edit required for the video alternative.
