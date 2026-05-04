<!-- closing-summary-audit.md
     Rendered after /zama-audit finishes. Substituted via
     `renderClosingSummary('audit', vars)` from skills/_lib/closing-summary.ts
     and transcluded into SKILL.md via `@sync:prompt:closing-summary-audit`.
     Placeholder syntax: {{key}}. -->

## ✅ /zama-audit complete — `{{scope}}`

### Findings

- **Critical:** `{{criticalCount}}` (ACL gap / cleartext leak / deprecated import)
- **Warning:** `{{warningCount}}` (HCU >12 ops, deprecated comment-only)
- **Info:** `{{infoCount}}`
- **Report:** `{{reportPath}}` (severity-classified, per-file, with file:line)

### Categories scanned

- ACL: `FHE.allowThis` / `FHE.allow(value, msg.sender)` reachability per `euint*` write
- Cleartext leak: revert messages / events / logs that surface decrypted values
- HCU explosion: FHE op count per function (>12 warn, >20 critical) — see Zama HCU table
- Deprecation: `fhevmjs`, `fhevm` root imports per `shared/deprecated-imports.json`

### Next:
- If findings found: run `/zama-debug` for fix recipes, or re-run `/zama-contract --regenerate` after editing.
- If clean (exit 0): you're ready to `/zama-deploy`.
