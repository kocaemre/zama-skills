{
  "name": "{{USE_CASE}}-dapp",
  "private": true,
  "version": "0.1.0",
  "engines": { "node": ">=20" },
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "compile": "pnpm --filter contracts hardhat compile",
    "test": "pnpm --filter contracts hardhat test",
    "dev:frontend": "pnpm --filter frontend dev"
  },
  "devDependencies": {
    "typescript": "^5.9.3"
  }
}
