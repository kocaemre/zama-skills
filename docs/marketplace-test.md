# Marketplace Install Verification

> **Requirement:** DIST-05 — confirm the public `/plugin marketplace add` round-trip works end-to-end inside Claude Code.

The README install snippet relies on the `kocaemre/zama-skills` GitHub repo being public and `marketplace.json` being reachable at the canonical raw URL. Claude cannot run slash commands inside its own session, so this verification is a **user-driven** checklist run from a real Claude Code window.

## Pre-flight

- [ ] Claude Code installed (`claude --version` shows ≥ the marketplace-supporting build).
- [ ] Repo `kocaemre/zama-skills` visibility is `PUBLIC`. Verify:
  ```bash
  gh repo view kocaemre/zama-skills --json visibility -q .visibility
  # → PUBLIC
  ```
- [ ] `marketplace.json` is reachable anonymously:
  ```bash
  curl -fsSL https://raw.githubusercontent.com/kocaemre/zama-skills/main/.claude-plugin/marketplace.json \
    | jq -e '.name == "zama-skills" and (.plugins | type == "array")'
  # → true
  ```

## Steps

Run these **in a Claude Code session** (any working directory is fine — the plugin installs globally to `~/.claude/`).

1. **Add the marketplace.**
   ```
   /plugin marketplace add github.com/kocaemre/zama-skills
   ```
   Expected: a confirmation line such as `Marketplace added: zama-skills` (exact wording may vary by Claude Code build). The marketplace metadata is fetched from the repo's `.claude-plugin/marketplace.json`.

2. **Install the plugin.**
   ```
   /plugin install zama-skills@zama-skills
   ```
   Format is `<plugin-name>@<marketplace-name>`. Expected: install confirmation; the 5 bundled skills (init, contract, test, deploy, frontend) are registered.

3. **List installed plugins** to confirm registration:
   ```
   /plugin list
   ```
   Expected: `zama-skills` appears with 5 skills.

4. **Verify autocomplete.** Type:
   ```
   /zama-skills:
   ```
   …and pause. Expected: autocomplete suggests `init`, `contract`, `test`, `deploy`, `frontend`.

5. **Smoke-test a skill load** (optional but recommended):
   ```
   /zama-skills:init --help
   ```
   Expected: skill loads without error, prints its usage text.

## Failure Modes

| Symptom | Likely Cause | Fix |
|---|---|---|
| Step 1: `marketplace.json not found` / 404 | Repo is still private, or default branch is not `main`. | Re-run `gh repo view kocaemre/zama-skills --json visibility -q .visibility` and confirm `PUBLIC`; check `gh repo view kocaemre/zama-skills --json defaultBranchRef -q .defaultBranchRef.name` is `main`. |
| Step 1: `invalid marketplace schema` | `.claude-plugin/marketplace.json` is malformed. | Re-validate with the `curl … \| jq -e …` pre-flight command above. |
| Step 2: `plugin source not found` | `plugins/zama-skills/.claude-plugin/plugin.json` missing or `source` path in marketplace.json wrong. | Confirm `plugins/zama-skills/.claude-plugin/plugin.json` exists in the repo and that `marketplace.json`'s `plugins[0].source` is `./plugins/zama-skills`. |
| Step 4: no autocomplete | Skill `SKILL.md` files missing frontmatter `name:` or wrong directory layout. | Inspect `~/.claude/plugins/zama-skills/plugins/zama-skills/skills/<name>/SKILL.md`. |

## Report Back

After step 4 succeeds, capture proof for the bounty submission:

- Save a screenshot of the autocomplete listing to `docs/marketplace-test-screenshot.png`, **or**
- Paste the terminal/log output of `/plugin list` into a fenced code block in this file under a new `## Verified Run` section, including the date and Claude Code version.

That artifact is the evidence DIST-05 was satisfied end-to-end.
