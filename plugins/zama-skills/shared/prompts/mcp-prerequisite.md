# Required & recommended MCP servers

This skill talks to two MCP servers. The first is **required**; the second is **recommended** for higher-quality UI output.

| MCP | Status | Why | Install |
|-----|--------|-----|---------|
| `context7` | **REQUIRED** | Live Zama / OpenZeppelin Confidential / fhEVM docs (anti-hallucination guarantee) | `claude mcp add context7 -- npx -y @upstash/context7-mcp` |
| `magic` (21st.dev) | **RECOMMENDED** for `/zama-frontend` and `/zama-design` | Production-grade UI component scaffolding (shadcn-flavored, design-system-aware) | `claude mcp add magic -- npx -y @21st-dev/magic` (sign-in required) |

## Detection (mandatory — run BEFORE code generation)

Before invoking any `mcp__context7__*` or `mcp__magic__*` tool, verify the tool is available. If a `context7` call would fail (tool not found / not in the available tool list):

1. **STOP**. Do NOT generate any code or write any file.
2. Tell the user (verbatim, do not paraphrase):

   ```
   This skill requires the context7 MCP server to fetch live Zama documentation.
   It does not appear to be installed.

   Install it (one-time setup):

       claude mcp add context7 -- npx -y @upstash/context7-mcp

   After install, restart Claude Code (or run /mcp to verify) and re-run this skill.
   ```

3. Wait for the user to confirm install. Re-attempt the call. If it still fails, tell the user to run `/zama-doctor` for a full diagnostic.

If a `magic` call would fail (only relevant for `/zama-frontend` and `/zama-design` UI generation):

1. Do NOT stop — magic is optional. Continue with hand-authored shadcn components.
2. Tell the user (once, near the start of UI generation):

   ```
   Magic MCP (21st.dev) is not installed. UI components will be hand-authored
   using shadcn primitives. For higher-quality, design-system-aware components,
   install Magic:

       claude mcp add magic -- npx -y @21st-dev/magic

   Then restart Claude Code and re-run this skill.
   ```

3. Continue without magic.

## No fallback for context7

context7 is hard-required. Every Zama / OpenZeppelin / fhEVM API the skill emits is verified against `/zama-ai/fhevm` (1772 HIGH-reputation snippets) and `/websites/openzeppelin_confidential-contracts` (354 snippets). A WebFetch fallback would weaken the anti-hallucination guarantee — if context7 is unavailable, the right answer is to fix the setup, not to silently degrade.

## When in doubt

Run `/zama-doctor` — it lists every required and recommended MCP/tool with install commands and a status check.
