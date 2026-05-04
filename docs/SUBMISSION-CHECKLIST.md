# zama-skills — Bounty Submission Checklist

**Submission target:** 2026-05-09 (≥24h before 2026-05-10 23:59 AOE deadline)
**Bounty:** Zama Developer Program Mainnet Season 2 — Bounty Track
**Submission form URL:** `<BOUNTY_FORM_URL>` _(user fills — Zama bounty submission form)_

This checklist is the final gate before clicking **Submit**. Walk every box top-to-bottom.
If any box cannot be ticked, **STOP and resolve before submission**.

---

## Pre-submission verification (operational)

### Repository & package
- [ ] All v1 requirements complete — cross-check `.planning/REQUIREMENTS.md` traceability table (should be 41/41 with phase pointers).
- [ ] `git status` clean on `main` (no uncommitted changes).
- [ ] CI green on `main` — https://github.com/kocaemre/zama-skills/actions (all required workflows passing on the latest commit).
- [ ] CI badge on README is green (matches the latest run).
- [ ] `npm view zama-skills version` returns `0.1.0` or higher.
- [ ] `npm view zama-skills` shows expected `files` array, no leaked secrets.
- [ ] `gh repo view kocaemre/zama-skills --json visibility` returns `"visibility": "PUBLIC"`.

### Smoke & marketplace
- [ ] `bash scripts/clean-vm-test.sh` exits 0 (DIST-06 — clean-VM end-to-end).
- [ ] In Claude Code: `/plugin marketplace add github.com/kocaemre/zama-skills` succeeds.
- [ ] In Claude Code: `/plugin install zama-skills@zama-skills` succeeds (06-05 verified).
- [ ] After install, all 5 slash commands resolve: `/zama-init`, `/zama-contract`, `/zama-test`, `/zama-deploy`, `/zama-frontend`.

### Live artifacts
- [ ] Live Sepolia contract loads with **verified source** on Etherscan:
      https://sepolia.etherscan.io/address/0x04Bd105DE7a5D3297c3747cef90ac8b760136896#code
- [ ] Live Vercel frontend loads with no console errors:
      https://zama-skills.vercel.app
- [ ] Frontend decryption round-trips end-to-end (encrypt input → contract call → decrypt) on Sepolia.

### Docs & supporting files
- [ ] README hero (one-liner + install + demo URL + skills table) readable above the fold on github.com.
- [ ] `THIRD_PARTY_LICENSES.md` present and complete (DIST-03).
- [ ] `generic/*.md` present (5 files — `init.md`, `contract.md`, `test.md`, `deploy.md`, `frontend.md`); CI drift check green (DIST-02).
- [ ] Demo GIF: either committed at `examples/confidential-token/docs/demo.gif`, or replaced with a "demo capture pending" note linking to `docs/demo-gif-capture.md`.
- [ ] `DEPLOYED.md` (or equivalent) lists the live contract address, deploy tx, and verify URL.

### Phase requirement traceability (all must be checked off in REQUIREMENTS.md)
- [ ] **PLUGIN-01..06** — marketplace.json + plugin.json + 5 SKILL.md + npx CLI + zod CI gate
- [ ] **SHARED-01..05** — pinned versions, context7 fragment, deprecated imports, build engine, prompts
- [ ] **INIT-01..06** — use-case prompt, template fork, .env.example, MetaMask deep-link, closing summary, smoke
- [ ] **CONTRACT-01..05** — euint typing, allowThis, OZ ERC-7984, decryption paths, HCU budget
- [ ] **TEST-01..04** — mock + Sepolia integration + allowThis assertion + HCU revert note
- [ ] **DEPLOY-01..05** — Sepolia deploy, registry registration, live address fetch, env validation, model-invocation gate
- [ ] **FRONTEND-01..04** — relayer-sdk + useDecrypted + encrypted input + ethers v6
- [ ] **EXAMPLE-01..05** — confidential-token example, deployed + verified + registered, Vercel live, snapshot, smoke-diff
- [ ] **DIST-01..07** — README, generic docs, licenses, npm publish, public repo, clean-VM, submission ≥24h early

---

## Submission form fields

Pre-fill the bounty form with:

| Field | Value |
|-------|-------|
| **GitHub repo URL** | `https://github.com/kocaemre/zama-skills` |
| **npm package URL** | `https://www.npmjs.com/package/zama-skills` |
| **Live demo URL** | `https://zama-skills.vercel.app` |
| **Live contract (Sepolia)** | `https://sepolia.etherscan.io/address/0x04Bd105DE7a5D3297c3747cef90ac8b760136896#code` |
| **Category** | Bounty Track / AI Agent Skills |

**Short pitch (≤280 chars):**
> 5 Claude Code skills + npm package that take a developer from empty dir to deployed confidential dApp on Sepolia in 30 min. Every line verified live against Zama docs via context7 — zero hallucinated APIs. Live demo + verified contract included.

**Long description:** Copy from README hero + "Why this exists" section.

---

## Final actions

1. **Tag the release**
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
2. **Create GitHub release**
   ```bash
   gh release create v0.1.0 \
     --title "v0.1.0 — Bounty submission" \
     --notes "First public release. See README + DEPLOYED.md."
   ```
   (Or paste hand-written notes summarizing what shipped.)
3. **Final review** — re-walk this checklist top-to-bottom one last time.
4. **Submit the bounty form** — fill exactly the fields in "Submission form fields" above. Submit at `<BOUNTY_FORM_URL>`.
5. **Record submission** — append a `## Submission record` section at the bottom of this file with:
   - Submission timestamp (UTC)
   - Submission ID / confirmation URL
   - Any reviewer-facing notes
6. **Confirm timing** — submission must land before **2026-05-10 23:59 AOE**; target is **2026-05-09** to leave a ≥24h buffer (DIST-07).

---

## Post-submission

- Watch the GitHub repo issues + the npm package page for jury questions.
- Do **NOT** push breaking changes to `main` until jury review is complete.
- Tag any post-submission patches as `v0.1.x` (not `v0.2.0`) and call them out in release notes if the jury is mid-review.

---

## Submission record

_(Append after submitting.)_

```
Submitted at: <UTC TIMESTAMP>
Submission ID / URL: <FROM FORM RESPONSE>
Notes: <ANY>
```
