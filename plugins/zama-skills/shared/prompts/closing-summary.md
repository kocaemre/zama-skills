# Closing Summary — Skill End Reporting Template

When a skill finishes its primary action, print a structured summary so the user knows exactly what changed, what's pinned, and what to do next.

## Template

```
## ✅ {{SKILL_NAME}} complete

### What was created/installed
{{INSTALLED_FILES}}

### Pinned versions used
<!-- @sync:snippet:versions-table -->
<!-- @endsync -->

### Sepolia next steps
<!-- @sync:snippet:sepolia-faucet -->
<!-- @endsync -->

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
- **Always** transclude the versions table and Sepolia URLs from the canonical snippets via the `@sync:snippet:*` markers above. Do not inline them.
- The skill runtime substitutes `{{...}}` placeholders before printing.
