---
phase: 02-shared-infrastructure
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - plugins/zama-skills/shared/pinned-versions.json
  - plugins/zama-skills/shared/deprecated-imports.json
  - scripts/lib/versions.ts
  - scripts/lib/versions.test.ts
autonomous: true
requirements: [SHARED-01, SHARED-03]
must_haves:
  truths:
    - "A maintainer edits exactly one file (pinned-versions.json) to bump any fhEVM/OZ version"
    - "Deprecated packages (fhevmjs, fhevm root) are flagged with replacement suggestions"
    - "A helper module exposes getVersion(pkg) and isDeprecated(pkg) used by build.ts and future skill enforcement hooks"
  artifacts:
    - path: "plugins/zama-skills/shared/pinned-versions.json"
      provides: "Single source of truth for all package versions"
      contains: "@fhevm/solidity"
    - path: "plugins/zama-skills/shared/deprecated-imports.json"
      provides: "Banlist of deprecated packages with replacement guidance"
      contains: "fhevmjs"
    - path: "scripts/lib/versions.ts"
      provides: "getVersion() and isDeprecated() helpers, zod schema validation"
      exports: ["getVersion", "isDeprecated", "loadVersions", "VersionsSchema"]
  key_links:
    - from: "scripts/lib/versions.ts"
      to: "plugins/zama-skills/shared/pinned-versions.json"
      via: "fs.readFile + zod parse"
      pattern: "pinned-versions\\.json"
    - from: "scripts/lib/versions.ts"
      to: "plugins/zama-skills/shared/deprecated-imports.json"
      via: "fs.readFile + zod parse"
      pattern: "deprecated-imports\\.json"
---

<objective>
Establish the single source of truth for fhEVM/OpenZeppelin package versions and deprecated import banlist. Create a typed helper module with zod schema validation that downstream sync/build/validate scripts will consume.

Purpose: Without a single versions registry, every skill, example, and generic doc would drift independently. This plan creates the canonical data files and the typed accessor module.

Output: pinned-versions.json (authored), deprecated-imports.json (authored), versions.ts helper module with unit tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/REQUIREMENTS.md
@.planning/phases/02-shared-infrastructure/02-CONTEXT.md
@scripts/validate.ts

<interfaces>
<!-- Existing dependencies already installed in package.json -->
- zod ^3.25.0 (devDependency, available for runtime via tsx)
- fs-extra ^11.2.0 (dependency)
- picocolors ^1.1.1 (dependency)
- vitest ^2.1.9 (devDependency)
- tsx ^4.21.0 (devDependency)

<!-- Filename resolution: REQUIREMENTS.md SHARED-01 specifies `pinned-versions.json` (NOT versions.json from CONTEXT.md). Use `pinned-versions.json` to satisfy the requirement spec verbatim. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author pinned-versions.json and deprecated-imports.json</name>
  <files>
    plugins/zama-skills/shared/pinned-versions.json,
    plugins/zama-skills/shared/deprecated-imports.json
  </files>
  <action>
    Create `plugins/zama-skills/shared/pinned-versions.json` with the schema:
    ```json
    {
      "$schema": "./pinned-versions.schema.json",
      "packages": {
        "@fhevm/solidity": { "version": "^0.11.1", "notes": "Solidity FHE library; replaces deprecated `fhevm` root pkg" },
        "@fhevm/hardhat-plugin": { "version": "^0.4.2", "notes": "Hardhat integration; pulls @fhevm/host-contracts@0.10.0 + @fhevm/mock-utils@0.4.2 automatically" },
        "@fhevm/mock-utils": { "version": "0.4.2", "exact": true, "notes": "Exact-version peer of hardhat-plugin" },
        "@zama-fhe/relayer-sdk": { "version": "^0.4.2", "notes": "Frontend SDK; replaces deprecated fhevmjs. Use 0.4.1 in devDependencies to match plugin peer; ^0.4.2 in frontend dependencies." },
        "@zama-fhe/relayer-sdk-dev": { "version": "0.4.1", "exact": true, "aliasOf": "@zama-fhe/relayer-sdk", "notes": "Devdep variant matching @fhevm/hardhat-plugin@0.4.2 exact peer" },
        "@openzeppelin/confidential-contracts": { "version": "^0.4.0", "notes": "ERC-7984 confidential token + governance" },
        "@openzeppelin/contracts": { "version": "^5.6.1" },
        "@openzeppelin/contracts-upgradeable": { "version": "^5.6.1" },
        "encrypted-types": { "version": "^0.0.4", "notes": "Required peer of hardhat-plugin and OZ confidential" },
        "hardhat": { "version": "^2.28.4", "notes": "Hardhat 2.x line; fhevm plugin does NOT yet support hardhat@3.x" },
        "ethers": { "version": "^6.16.0", "notes": "v6 only; v5 incompatible with fhevm-plugin and typechain output" },
        "@nomicfoundation/hardhat-ethers": { "version": "^3.1.3" },
        "@nomicfoundation/hardhat-chai-matchers": { "version": "^2.1.0" },
        "@nomicfoundation/hardhat-network-helpers": { "version": "^1.1.2" },
        "@nomicfoundation/hardhat-verify": { "version": "^2.1.3" },
        "hardhat-deploy": { "version": "^0.11.45" },
        "hardhat-gas-reporter": { "version": "^2.3.0" },
        "solidity-coverage": { "version": "^0.8.17" },
        "@typechain/ethers-v6": { "version": "^0.5.1" },
        "@typechain/hardhat": { "version": "^9.1.0" },
        "typechain": { "version": "^8.3.2" },
        "dotenv": { "version": "^16.5.0" },
        "cross-env": { "version": "^7.0.3" },
        "mocha": { "version": "^11.7.5" },
        "chai": { "version": "^4.5.0" },
        "chai-as-promised": { "version": "^8.0.2" },
        "rimraf": { "version": "^6.1.2" },
        "solhint": { "version": "^6.0.3" },
        "prettier-plugin-solidity": { "version": "^2.2.1" },
        "prettier": { "version": "^3.8.1" },
        "eslint": { "version": "^9.39.2" },
        "typescript-eslint": { "version": "^8.54.0" }
      },
      "compiler": {
        "solc": "0.8.27"
      },
      "node": ">=20",
      "typescript": "^5.9.3"
    }
    ```

    Create `plugins/zama-skills/shared/deprecated-imports.json`:
    ```json
    {
      "$schema": "./deprecated-imports.schema.json",
      "deprecated": {
        "fhevmjs": {
          "deprecated": true,
          "replaces": "@zama-fhe/relayer-sdk",
          "deprecatedAt": "2025-07-10",
          "notes": "Officially deprecated by Zama. Skills MUST refuse to emit imports for this package."
        },
        "fhevm": {
          "deprecated": true,
          "replaces": "@fhevm/solidity",
          "deprecatedAt": "2025-07-10",
          "notes": "Root fhevm package deprecated. Use @fhevm/solidity for Solidity-side FHE primitives."
        }
      },
      "incompatible": {
        "hardhat@^3": {
          "incompatible": true,
          "reason": "fhevm-plugin peer-deps hardhat@^2.0.0; v3 untested with breaking config changes",
          "useInstead": "hardhat@^2.28.4"
        },
        "ethers@^5": {
          "incompatible": true,
          "reason": "fhevm-plugin pins ethers v6; v5 mismatches typechain output",
          "useInstead": "ethers@^6.16.0"
        }
      }
    }
    ```

    Both files MUST be valid JSON (run `jq . < file` to confirm).
  </action>
  <verify>
    <automated>node -e "JSON.parse(require('fs').readFileSync('plugins/zama-skills/shared/pinned-versions.json','utf8')); JSON.parse(require('fs').readFileSync('plugins/zama-skills/shared/deprecated-imports.json','utf8')); console.log('OK');"</automated>
  </verify>
  <done>
    Both JSON files exist, parse cleanly, and contain every pinned version listed in the constraints section verbatim. fhevmjs and fhevm appear in deprecated-imports.json with replaces fields.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement scripts/lib/versions.ts helper module with zod schema</name>
  <files>scripts/lib/versions.ts, scripts/lib/versions.test.ts</files>
  <behavior>
    - getVersion("@fhevm/solidity") returns "^0.11.1"
    - getVersion("@fhevm/mock-utils") returns "0.4.2" (exact, no caret)
    - getVersion("nonexistent") throws with a clear "package not found in pinned-versions.json" error
    - isDeprecated("fhevmjs") returns true with replacement = "@zama-fhe/relayer-sdk"
    - isDeprecated("@fhevm/solidity") returns false
    - loadVersions() validates the JSON shape with zod and throws on schema violations (test by passing a fixture with missing version field)
    - getCompilerVersion() returns "0.8.27"
  </behavior>
  <action>
    Create `scripts/lib/versions.ts` (ESM, TypeScript) exporting:

    ```typescript
    import { z } from "zod";
    import { readFileSync } from "node:fs";
    import { resolve } from "node:path";

    const PackageEntrySchema = z.object({
      version: z.string(),
      exact: z.boolean().optional(),
      aliasOf: z.string().optional(),
      notes: z.string().optional(),
    });

    export const VersionsSchema = z.object({
      $schema: z.string().optional(),
      packages: z.record(PackageEntrySchema),
      compiler: z.object({ solc: z.string() }),
      node: z.string(),
      typescript: z.string(),
    });

    export const DeprecatedSchema = z.object({
      $schema: z.string().optional(),
      deprecated: z.record(z.object({
        deprecated: z.literal(true),
        replaces: z.string(),
        deprecatedAt: z.string().optional(),
        notes: z.string().optional(),
      })),
      incompatible: z.record(z.object({
        incompatible: z.literal(true),
        reason: z.string(),
        useInstead: z.string(),
      })),
    });

    export type Versions = z.infer<typeof VersionsSchema>;
    export type Deprecated = z.infer<typeof DeprecatedSchema>;

    const SHARED_DIR = resolve(process.cwd(), "plugins/zama-skills/shared");

    let _versions: Versions | null = null;
    let _deprecated: Deprecated | null = null;

    export function loadVersions(path = resolve(SHARED_DIR, "pinned-versions.json")): Versions {
      const raw = JSON.parse(readFileSync(path, "utf8"));
      const parsed = VersionsSchema.parse(raw);
      _versions = parsed;
      return parsed;
    }

    export function loadDeprecated(path = resolve(SHARED_DIR, "deprecated-imports.json")): Deprecated {
      const raw = JSON.parse(readFileSync(path, "utf8"));
      const parsed = DeprecatedSchema.parse(raw);
      _deprecated = parsed;
      return parsed;
    }

    export function getVersion(pkg: string): string {
      const v = _versions ?? loadVersions();
      const entry = v.packages[pkg];
      if (!entry) throw new Error(`Package not found in pinned-versions.json: ${pkg}`);
      return entry.version;
    }

    export function isDeprecated(pkg: string): { deprecated: boolean; replaces?: string; reason?: string } {
      const d = _deprecated ?? loadDeprecated();
      const entry = d.deprecated[pkg];
      if (entry) return { deprecated: true, replaces: entry.replaces, reason: entry.notes };
      return { deprecated: false };
    }

    export function getCompilerVersion(): string {
      const v = _versions ?? loadVersions();
      return v.compiler.solc;
    }

    export function listAllPackages(): string[] {
      const v = _versions ?? loadVersions();
      return Object.keys(v.packages);
    }

    /** Reset module state — for tests only. */
    export function _resetCache(): void {
      _versions = null;
      _deprecated = null;
    }
    ```

    Create `scripts/lib/versions.test.ts` with vitest covering every behavior listed above. Use `_resetCache()` between tests.
  </action>
  <verify>
    <automated>pnpm vitest run scripts/lib/versions.test.ts</automated>
  </verify>
  <done>
    versions.ts exports getVersion, isDeprecated, loadVersions, loadDeprecated, getCompilerVersion, listAllPackages, VersionsSchema, DeprecatedSchema. All vitest tests pass. `pnpm typecheck` clean.
  </done>
</task>

</tasks>

<verification>
1. `node -e "JSON.parse(require('fs').readFileSync('plugins/zama-skills/shared/pinned-versions.json','utf8'))"` succeeds.
2. `pnpm vitest run scripts/lib/versions.test.ts` all green.
3. `pnpm typecheck` reports zero errors.
4. `grep -c '"@fhevm/solidity"' plugins/zama-skills/shared/pinned-versions.json` returns ≥1.
5. `grep -c '"fhevmjs"' plugins/zama-skills/shared/deprecated-imports.json` returns ≥1.
</verification>

<success_criteria>
- Two JSON data files exist with all CLAUDE.md-pinned versions and the two known deprecations.
- Helper module loads + validates them with zod and exposes getVersion/isDeprecated.
- Unit tests cover happy path, exact-version handling, deprecated lookup, and schema rejection.
</success_criteria>

<output>
Create `.planning/phases/02-shared-infrastructure/02-01-SUMMARY.md` listing artifacts, schema choices, and any deviations from CONTEXT.md filename (note: SHARED-01 uses `pinned-versions.json`, not `versions.json`).
</output>
</content>
</invoke>