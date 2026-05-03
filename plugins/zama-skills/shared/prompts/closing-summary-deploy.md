<!-- closing-summary-deploy.md
     Rendered after /zama-deploy finishes. Substituted via
     `renderClosingSummary('deploy', vars)` from skills/_lib/closing-summary.ts
     and transcluded into SKILL.md via `@sync:prompt:closing-summary-deploy`.
     Placeholder syntax: {{key}}. -->

## ✅ /zama-deploy complete — Sepolia

### Deployment

- **Address:** `{{address}}` ([Etherscan]({{etherscanUrl}}))
- **Verification:** `{{verifyStatus}}`
- **Confidential Token Registry:** `{{registryStatus}}`
- **ABI exported:** `{{abiPath}}`

### Frontend env reminder

Add the deployed address to `packages/frontend/.env`:

```env
VITE_{{NAME_UPPER}}_ADDRESS={{address}}
```

> Sepolia ACL/KMS/Coprocessor addresses were fetched LIVE from `https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia` — never pinned in source.

### Next: run `/zama-frontend` to wire UI hooks to `{{address}}`.
