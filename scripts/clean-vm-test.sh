#!/usr/bin/env bash
# zama-skills clean-VM smoke test
# Simulates a fresh-environment install of the published `zama-skills` npm package
# and asserts that all 10 SKILL.md bundles are copied into `.claude/skills/zama-skills/`.
#
# Implements DIST-06 (clean-VM smoke verification).
#
# Usage:
#   bash scripts/clean-vm-test.sh                # default: temp dir, auto-cleanup
#   bash scripts/clean-vm-test.sh --keep         # preserve temp dir for inspection
#   bash scripts/clean-vm-test.sh --with-marketplace  # also print Claude Code
#                                                 # marketplace-add instructions
#
# Exit codes:
#   0  smoke passed
#   1  any assertion failed
#   2  dependency missing (npx / node)

set -euo pipefail

# ---- color helpers ----
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
BOLD=$'\033[1m'
NC=$'\033[0m'

err() { printf "%s✗ %s%s\n" "$RED" "$*" "$NC" >&2; }
ok()  { printf "%s✓ %s%s\n" "$GREEN" "$*" "$NC"; }
info(){ printf "%s» %s%s\n" "$YELLOW" "$*" "$NC"; }

# ---- flag parsing ----
KEEP=0
WITH_MARKETPLACE=0
for arg in "$@"; do
  case "$arg" in
    --keep) KEEP=1 ;;
    --with-marketplace) WITH_MARKETPLACE=1 ;;
    -h|--help)
      sed -n '2,15p' "$0"
      exit 0
      ;;
    *)
      err "Unknown flag: $arg"
      exit 1
      ;;
  esac
done

# ---- banner ----
printf "\n%s================================================%s\n" "$BOLD" "$NC"
printf "%s zama-skills clean-VM smoke test%s\n" "$BOLD" "$NC"
printf "%s================================================%s\n\n" "$BOLD" "$NC"

# ---- dependency check ----
command -v npx >/dev/null 2>&1 || { err "npx not found — install Node.js >=20"; exit 2; }
command -v node >/dev/null 2>&1 || { err "node not found — install Node.js >=20"; exit 2; }

NODE_VERSION=$(node --version)
info "Node version: $NODE_VERSION"

# ---- workspace ----
WORK=$(mktemp -d -t zama-skills-smoke-XXXXXX)
info "Workspace: $WORK"

if [ "$KEEP" -eq 0 ]; then
  trap 'rm -rf "$WORK"' EXIT
else
  info "(--keep) Workspace will be preserved on exit."
fi

cd "$WORK"

# ---- run installer ----
START=$(date +%s)
info "Running: npx --yes zama-skills@latest install --scope project --tool claude-code --force"
if ! npx --yes zama-skills@latest install --scope project --tool claude-code --force; then
  err "npx zama-skills install failed."
  exit 1
fi
END=$(date +%s)
ELAPSED=$((END - START))
ok "npx install completed in ${ELAPSED}s"

# ---- assertions ----
info "Verifying installed skill bundles..."

assert_path() {
  local kind="$1"; local path="$2"
  if [ "$kind" = "dir" ]; then
    [ -d "$path" ] || { err "missing directory: $path"; exit 1; }
  else
    [ -f "$path" ] || { err "missing file: $path"; exit 1; }
  fi
  ok "found $kind: $path"
}

assert_path dir  ".claude/skills/zama-skills"
assert_path file ".claude/skills/zama-skills/init/SKILL.md"
assert_path file ".claude/skills/zama-skills/contract/SKILL.md"
assert_path file ".claude/skills/zama-skills/test/SKILL.md"
assert_path file ".claude/skills/zama-skills/deploy/SKILL.md"
assert_path file ".claude/skills/zama-skills/frontend/SKILL.md"
assert_path file ".claude/skills/zama-skills/design/SKILL.md"
assert_path file ".claude/skills/zama-skills/audit/SKILL.md"
assert_path file ".claude/skills/zama-skills/debug/SKILL.md"
assert_path file ".claude/skills/zama-skills/doctor/SKILL.md"
assert_path file ".claude/skills/zama-skills/autonomous/SKILL.md"

# PLUGIN-03 spot check — deploy SKILL must keep `disable-model-invocation: true`
# after the npm round-trip. If a build step strips frontmatter, this catches it.
if grep -q 'disable-model-invocation: true' .claude/skills/zama-skills/deploy/SKILL.md; then
  ok "PLUGIN-03 spot check: 'disable-model-invocation: true' preserved in deploy/SKILL.md"
else
  err "PLUGIN-03 spot check FAILED: deploy/SKILL.md missing 'disable-model-invocation: true'"
  exit 1
fi

# ---- optional marketplace instructions ----
if [ "$WITH_MARKETPLACE" -eq 1 ]; then
  printf "\n%s» Marketplace install (run inside Claude Code, interactive):%s\n" "$YELLOW" "$NC"
  cat <<'EOF'
    /plugin marketplace add github.com/kocaemre/zama-skills
    /plugin install zama-skills@zama-skills
EOF
  info "Claude Code is interactive — these slash commands cannot be invoked from bash."
fi

# ---- success ----
TOTAL=$(( $(date +%s) - START ))
printf "\n"
ok "clean-VM smoke passed (total ${TOTAL}s)"
if [ "$KEEP" -eq 1 ]; then
  printf "%s» Workspace preserved at: %s%s\n" "$YELLOW" "$WORK" "$NC"
else
  info "Workspace will be cleaned on exit."
fi
exit 0
