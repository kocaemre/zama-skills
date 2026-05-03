# Closing Summary — Skill End Reporting Template

When a skill finishes its primary action, print a structured summary so the user knows exactly what changed, what's pinned, and what to do next.

## Template

```
## ✅ {{SKILL_NAME}} complete

### What was created/installed
{{INSTALLED_FILES}}

### Pinned versions used
{{VERSIONS_TABLE}}  ← the skill substitutes the table from `shared/snippets/versions-table.md` at runtime

### Sepolia next steps
{{SEPOLIA_FAUCET}}  ← the skill substitutes the URLs from `shared/snippets/sepolia-faucet.md` at runtime

Add Sepolia to MetaMask: https://chainid.network/?search=sepolia

### What was NOT done
{{NOT_DONE_LIST}}

### Recommended next skill
{{NEXT_SKILL}} — {{NEXT_SKILL_REASON}}
```

## Placeholder reference

| Token | Meaning | Example |
|-------|---------|---------|
| `{{SKILL_NAME}}` | Name of the skill that just ran | `/zama-init` |
| `{{INSTALLED_FILES}}` | Bulleted list of files created or modified | `- contracts/MyToken.sol` |
| `{{NOT_DONE_LIST}}` | Explicit list of deferred actions, one per line | `- I did NOT deploy yet — run /zama-deploy when ready` |
| `{{NEXT_SKILL}}` | Slash-command name of the next skill to run | `/zama-contract` |
| `{{NEXT_SKILL_REASON}}` | One-line rationale for the recommendation | `scaffold an ERC-7984 confidential token` |

## Rules

- **Always** include the "What was NOT done" section. Skills must be honest about scope — never imply work was completed when it was deferred.
- **Always** substitute `{{VERSIONS_TABLE}}` and `{{SEPOLIA_FAUCET}}` at skill runtime by reading the canonical snippets from `shared/snippets/versions-table.md` and `shared/snippets/sepolia-faucet.md`. Do not inline them in this template.
- The skill runtime substitutes `{{...}}` placeholders before printing.
