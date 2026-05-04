# Third-Party Licenses

This document attributes the third-party packages that **`zama-skills`** depends on, bundles, or scaffolds into generated dApps. Each package retains its original license; this file reproduces the required notices per those license terms.

Three surfaces are covered:

1. **Root package** (`package.json`) — the `zama-skills` CLI and Claude Code plugin.
2. **Scaffolded contracts** (`examples/confidential-token/packages/contracts/package.json`) — what `/zama-init` produces on the Hardhat side.
3. **Scaffolded frontend** (`examples/confidential-token/packages/frontend/package.json`) — what `/zama-init` produces on the Next.js side.

License versions and SPDX identifiers were verified against the npm registry via `npm view <pkg> license` on **2026-05-04** and cross-checked against the in-repo `package.json` files.

---

## 1. Zama Protocol (fhEVM) — BSD-3-Clause-Clear

| Package | Version | Source | Copyright |
|---------|---------|--------|-----------|
| `@fhevm/solidity` | `^0.11.1` | https://github.com/zama-ai/fhevm | © Zama SAS |
| `@fhevm/hardhat-plugin` | `^0.4.2` | https://github.com/zama-ai/fhevm-hardhat-plugin | © Zama SAS |
| `@fhevm/mock-utils` | `0.4.2` | https://github.com/zama-ai/fhevm | © Zama SAS |
| `@fhevm/host-contracts` | `0.10.0` | https://github.com/zama-ai/fhevm | © Zama SAS |
| `@zama-fhe/relayer-sdk` | `0.4.1` (contracts) / `^0.4.2` (frontend) | https://github.com/zama-ai/relayer-sdk | © Zama SAS |

**SPDX:** `BSD-3-Clause-Clear`
**Canonical text:** https://spdx.org/licenses/BSD-3-Clause-Clear.html
**Upstream license file:** https://github.com/zama-ai/fhevm/blob/main/LICENSE

### Important: BSD-3-Clause-Clear patent clause

`BSD-3-Clause-Clear` differs from the standard 3-clause BSD by **explicitly disclaiming any patent grant**. Downstream users must take note that no patent rights are conveyed by the license; any patent practice is at the user's own risk. This clause is reproduced verbatim in the full text below.

<details>
<summary>Full BSD-3-Clause-Clear license text</summary>

```
The Clear BSD License

Copyright (c) Zama SAS
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted (subject to the limitations in the disclaimer
below) provided that the following conditions are met:

     * Redistributions of source code must retain the above copyright notice,
     this list of conditions and the following disclaimer.

     * Redistributions in binary form must reproduce the above copyright
     notice, this list of conditions and the following disclaimer in the
     documentation and/or other materials provided with the distribution.

     * Neither the name of the copyright holder nor the names of its
     contributors may be used to endorse or promote products derived from this
     software without specific prior written permission.

NO EXPRESS OR IMPLIED LICENSES TO ANY PARTY'S PATENT RIGHTS ARE GRANTED BY
THIS LICENSE. THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND
CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT
NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER
OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

</details>

---

## 2. OpenZeppelin Confidential & Standard Contracts — MIT

| Package | Version | Source | Copyright |
|---------|---------|--------|-----------|
| `@openzeppelin/confidential-contracts` | `^0.4.0` | https://github.com/OpenZeppelin/openzeppelin-confidential-contracts | © OpenZeppelin |
| `@openzeppelin/contracts` | `^5.6.1` | https://github.com/OpenZeppelin/openzeppelin-contracts | © OpenZeppelin |

**SPDX:** `MIT`
**Upstream license file (confidential):** https://github.com/OpenZeppelin/openzeppelin-confidential-contracts/blob/master/LICENSE
**Upstream license file (standard):** https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/LICENSE

---

## 3. Frontend Stack — MIT

| Package | Version | Source | Copyright |
|---------|---------|--------|-----------|
| `next` | `^15.0.3` | https://github.com/vercel/next.js | © Vercel, Inc. |
| `react` | `^18.3.1` | https://github.com/facebook/react | © Meta Platforms, Inc. and affiliates |
| `react-dom` | `^18.3.1` | https://github.com/facebook/react | © Meta Platforms, Inc. and affiliates |
| `ethers` | `^6.16.0` | https://github.com/ethers-io/ethers.js | © Richard Moore |
| `viem` | `^2.21.0` | https://github.com/wevm/viem | © wevm (wagmi-dev) |
| `wagmi` | `^2.13.0` | https://github.com/wevm/wagmi | © wevm (wagmi-dev) |
| `@rainbow-me/rainbowkit` | `^2.2.0` | https://github.com/rainbow-me/rainbowkit | © Rainbow |
| `@tanstack/react-query` | `^5.59.0` | https://github.com/TanStack/query | © Tanner Linsley |
| `tailwindcss` | `^3.4.14` | https://github.com/tailwindlabs/tailwindcss | © Tailwind Labs Inc. |
| `tailwind-merge` | `^2.5.4` | https://github.com/dcastil/tailwind-merge | © Dany Castillo |
| `tailwindcss-animate` | `^1.0.7` | https://github.com/jamiebuilds/tailwindcss-animate | © Jamie Kyle |
| `class-variance-authority` | `^0.7.1` | https://github.com/joe-bell/cva | © Joe Bell |
| `clsx` | `^2.1.1` | https://github.com/lukeed/clsx | © Luke Edwards |
| `lucide-react` | `^0.460.0` | https://github.com/lucide-icons/lucide | © Lucide Contributors |
| `next-themes` | `^0.3.0` | https://github.com/pacocoursey/next-themes | © Paco Coursey |
| `sonner` | `^1.7.0` | https://github.com/emilkowalski/sonner | © Emil Kowalski |
| `@radix-ui/react-dialog` | `^1.1.2` | https://github.com/radix-ui/primitives | © WorkOS |
| `@radix-ui/react-slot` | `^1.1.0` | https://github.com/radix-ui/primitives | © WorkOS |
| `encrypted-types` | `^0.0.4` | https://github.com/zama-ai/encrypted-types | © Zama SAS |

### shadcn/ui — MIT (source-distributed)

| Source | License | Copyright |
|--------|---------|-----------|
| https://github.com/shadcn-ui/ui | MIT | © shadcn |

`shadcn/ui` is **not** an npm dependency — it is a registry of source files copied directly into the consumer's repo via the `shadcn` CLI. Each component file is MIT-licensed at the time of copy. Because the source is vendored into the user's tree, the user becomes the steward of those files and is responsible for preserving the MIT notice if redistributing them as a separate work.

---

## 4. Hardhat & Build Tooling — MIT

These appear in `examples/confidential-token/packages/contracts/package.json` `devDependencies` and at the root.

| Package | Version | Source |
|---------|---------|--------|
| `hardhat` | `^2.28.4` | https://github.com/NomicFoundation/hardhat |
| `@nomicfoundation/hardhat-ethers` | `^3.1.3` | https://github.com/NomicFoundation/hardhat |
| `@nomicfoundation/hardhat-chai-matchers` | `^2.1.0` | https://github.com/NomicFoundation/hardhat |
| `@nomicfoundation/hardhat-network-helpers` | `^1.1.2` | https://github.com/NomicFoundation/hardhat |
| `@nomicfoundation/hardhat-verify` | `^2.1.3` | https://github.com/NomicFoundation/hardhat |
| `hardhat-deploy` | `^0.11.45` | https://github.com/wighawag/hardhat-deploy |
| `hardhat-gas-reporter` | `^2.3.0` | https://github.com/cgewecke/hardhat-gas-reporter |
| `solidity-coverage` | `^0.8.17` | https://github.com/sc-forks/solidity-coverage |
| `@typechain/ethers-v6` | `^0.5.1` | https://github.com/dethcrypto/TypeChain |
| `@typechain/hardhat` | `^9.1.0` | https://github.com/dethcrypto/TypeChain |
| `typechain` | `^8.3.2` | https://github.com/dethcrypto/TypeChain |
| `mocha` | `^11.7.5` | https://github.com/mochajs/mocha |
| `chai` | `^4.5.0` | https://github.com/chaijs/chai |
| `chai-as-promised` | `^8.0.2` | https://github.com/domenic/chai-as-promised |
| `solhint` | `^6.0.3` | https://github.com/protofire/solhint |
| `prettier` | `^3.8.1` | https://github.com/prettier/prettier |
| `prettier-plugin-solidity` | `^2.2.1` | https://github.com/prettier-solidity/prettier-plugin-solidity |
| `eslint` | `^9.39.2` | https://github.com/eslint/eslint |
| `typescript-eslint` | `^8.54.0` | https://github.com/typescript-eslint/typescript-eslint |
| `dotenv` | `^16.5.0` | https://github.com/motdotla/dotenv |
| `cross-env` | `^7.0.3` | https://github.com/kentcdodds/cross-env |
| `rimraf` | `^6.1.2` | https://github.com/isaacs/rimraf |
| `ts-node` | `^10.9.2` | https://github.com/TypeStrong/ts-node |
| `autoprefixer` | `^10.4.20` | https://github.com/postcss/autoprefixer |
| `postcss` | `^8.4.49` | https://github.com/postcss/postcss |

All of the above are distributed under **MIT** (verified via `npm view`).

---

## 5. Root CLI Tooling — MIT

From the root `package.json` (the `zama-skills` Claude Code plugin / npx CLI itself):

| Package | Version | Source |
|---------|---------|--------|
| `commander` | `^12.1.0` | https://github.com/tj/commander.js |
| `fs-extra` | `^11.2.0` | https://github.com/jprichardson/node-fs-extra |
| `picocolors` | `^1.1.1` | https://github.com/alexeyraspopov/picocolors |
| `prompts` | `^2.4.2` | https://github.com/terkelg/prompts |
| `tsx` | `^4.21.0` | https://github.com/privatenumber/tsx |
| `typescript` | `^5.9.3` | https://github.com/microsoft/TypeScript (Apache-2.0) |
| `vitest` | `^2.1.9` | https://github.com/vitest-dev/vitest |
| `zod` | `^3.25.0` | https://github.com/colinhacks/zod |
| `@types/node`, `@types/fs-extra`, `@types/prompts`, `@types/react`, `@types/react-dom`, `@types/mocha`, `@types/chai` | `*` | DefinitelyTyped — https://github.com/DefinitelyTyped/DefinitelyTyped |

All of the above are **MIT**, with the single exception of **`typescript`**, which is distributed under **Apache-2.0** (see https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt). DefinitelyTyped (`@types/*`) is published under MIT.

---

## 6. Full MIT License Text

The MIT license is shared by the majority of packages above. It is reproduced once here, as required by its terms. Each package's individual copyright notice is given in the tables above.

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

---

## How this file is maintained

Add new dependencies to the appropriate table when added to any of:

- `package.json` (root)
- `examples/confidential-token/package.json`
- `examples/confidential-token/packages/contracts/package.json`
- `examples/confidential-token/packages/frontend/package.json`
- Skill asset templates under `plugins/zama-skills/skills/*/assets/`

Re-verify every entry's license + version constraint with:

```bash
npm view <pkg> license
npm view <pkg> repository.url
```

before each release. Particular attention is required for:

- **`@fhevm/*` and `@zama-fhe/*`** — BSD-3-Clause-Clear is **not** identical to BSD-3-Clause; never collapse them.
- **`encrypted-types`** — published under MIT despite being a Zama package; do not assume Zama-namespaced packages are uniformly BSD-3-Clause-Clear.
- **`typescript`** — Apache-2.0, not MIT.

---

_Last verified: 2026-05-04 against the npm registry. Source: `npm view <pkg> license` for every entry above._
