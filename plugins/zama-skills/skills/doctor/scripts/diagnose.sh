#!/usr/bin/env bash
# /zama-doctor — read-only environment diagnostic
# Prints a per-check report. Exit codes:
#   0  all required pass (recommended may be missing)
#   1  one or more required missing

set -uo pipefail

# colors
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
BOLD=$'\033[1m'
NC=$'\033[0m'

REQUIRED_FAIL=0
RECOMMENDED_FAIL=0

ok()      { printf "%s✓ %s%s\n" "$GREEN" "$*" "$NC"; }
warn()    { printf "%s⚠ %s%s\n" "$YELLOW" "$*" "$NC"; }
fail_r()  { printf "%s✗ REQUIRED: %s%s\n" "$RED" "$*" "$NC"; REQUIRED_FAIL=$((REQUIRED_FAIL+1)); }
fail_o()  { printf "%s✗ RECOMMENDED: %s%s\n" "$YELLOW" "$*" "$NC"; RECOMMENDED_FAIL=$((RECOMMENDED_FAIL+1)); }
hint()    { printf "    %s↳ fix:%s %s\n" "$BOLD" "$NC" "$*"; }

printf "\n%s========================================%s\n" "$BOLD" "$NC"
printf "%s zama-skills environment diagnostic%s\n" "$BOLD" "$NC"
printf "%s========================================%s\n\n" "$BOLD" "$NC"

# ---- Runtime ----
printf "%sRuntime%s\n" "$BOLD" "$NC"

if command -v node >/dev/null 2>&1; then
  NV=$(node --version | sed 's/^v//')
  MAJOR=${NV%%.*}
  if [ "$MAJOR" -ge 20 ]; then
    ok "Node.js $NV (>=20)"
  else
    fail_r "Node.js $NV — need >= 20"
    hint "install via nvm: nvm install 20 && nvm alias default 20"
  fi
else
  fail_r "Node.js not found"
  hint "install via nvm: https://github.com/nvm-sh/nvm"
fi

if command -v pnpm >/dev/null 2>&1; then
  ok "pnpm $(pnpm --version)"
else
  fail_r "pnpm not found"
  hint "install: npm install -g pnpm@10"
fi

if command -v git >/dev/null 2>&1; then
  ok "git $(git --version | awk '{print $3}')"
else
  fail_r "git not found"
  hint "install via your OS package manager (brew install git on macOS)"
fi

# ---- MCP servers ----
printf "\n%sMCP servers%s\n" "$BOLD" "$NC"

if command -v claude >/dev/null 2>&1; then
  MCP_LIST=$(claude mcp list 2>/dev/null || true)
  if echo "$MCP_LIST" | grep -qiE "(^|[[:space:]])context7([[:space:]]|$)"; then
    ok "context7 MCP installed"
  else
    fail_r "context7 MCP not installed"
    hint "claude mcp add context7 -- npx -y @upstash/context7-mcp"
  fi

  if echo "$MCP_LIST" | grep -qiE "(^|[[:space:]])magic([[:space:]]|$)"; then
    ok "magic MCP installed (21st.dev components)"
  else
    fail_o "magic MCP not installed (recommended for /zama-frontend, /zama-design)"
    hint "claude mcp add magic -- npx -y @21st-dev/magic"
  fi
else
  warn "claude CLI not found on PATH — cannot verify MCP servers"
  hint "if running inside Claude Code, MCPs may still be available; install via Settings > MCP"
fi

# ---- Network ----
printf "\n%sNetwork%s\n" "$BOLD" "$NC"

SEPOLIA_OK=0
for RPC in https://ethereum-sepolia.publicnode.com https://1rpc.io/sepolia https://sepolia.gateway.tenderly.co; do
  if curl -sS --max-time 4 -X POST -H "Content-Type: application/json" \
      --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
      "$RPC" 2>/dev/null | grep -q '"result"'; then
    ok "Sepolia RPC reachable: $RPC"
    SEPOLIA_OK=1
    break
  fi
done
if [ "$SEPOLIA_OK" -eq 0 ]; then
  fail_o "no Sepolia public RPC reachable (only needed for /zama-deploy)"
  hint "check internet / corporate firewall; or use your own Alchemy/Infura RPC"
fi

if curl -sS --max-time 4 -o /dev/null -w "%{http_code}" \
    https://relayer.testnet.zama.cloud 2>/dev/null | grep -qE "^(200|301|302|404|405)$"; then
  ok "Zama relayer endpoint reachable"
else
  fail_o "Zama relayer not reachable (only needed for /zama-frontend round-trip tests)"
  hint "check status at https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia"
fi

# ---- Plugin ----
printf "\n%sPlugin%s\n" "$BOLD" "$NC"

if command -v claude >/dev/null 2>&1; then
  PL_LIST=$(claude plugin list 2>/dev/null || true)
  if echo "$PL_LIST" | grep -qi "zama-skills"; then
    ok "zama-skills plugin installed in Claude Code"
  else
    warn "zama-skills plugin not detected via claude CLI (you may have installed via npx instead)"
    hint "in Claude Code: /plugin marketplace add github.com/kocaemre/zama-skills && /plugin install zama-skills@zama-skills"
  fi
fi

# ---- Project ----
printf "\n%sCurrent directory%s\n" "$BOLD" "$NC"

if [ -f package.json ]; then
  PKG_NAME=$(node -e "console.log(require('./package.json').name||'(no name)')" 2>/dev/null || echo "(parse error)")
  warn "package.json present (project: $PKG_NAME) — /zama-init would NOT scaffold here. cd to an empty dir first."
else
  ok "no package.json — /zama-init can scaffold here"
fi

# ---- Verdict ----
printf "\n%s========================================%s\n" "$BOLD" "$NC"
if [ "$REQUIRED_FAIL" -gt 0 ]; then
  printf "%s✗ Setup incomplete: %d required check(s) failed%s\n" "$RED" "$REQUIRED_FAIL" "$NC"
  printf "%s  Run the suggested 'fix' commands above, then re-run /zama-doctor%s\n" "$RED" "$NC"
  printf "%s========================================%s\n\n" "$BOLD" "$NC"
  exit 1
else
  if [ "$RECOMMENDED_FAIL" -gt 0 ]; then
    printf "%s✓ Required pass; %d recommended missing%s\n" "$GREEN" "$RECOMMENDED_FAIL" "$NC"
    printf "%s  You can run /zama-design and /zama-init now.%s\n" "$GREEN" "$NC"
    printf "%s  Recommended fixes will improve output quality / unlock optional flows.%s\n" "$YELLOW" "$NC"
  else
    printf "%s✓ All checks passed — ready to ship%s\n" "$GREEN" "$NC"
    printf "%s  Try: /zama-design (plan from idea) or /zama-init (scaffold a known use-case)%s\n" "$GREEN" "$NC"
  fi
  printf "%s========================================%s\n\n" "$BOLD" "$NC"
  exit 0
fi
