---
phase: 03-zama-init-end-to-end
plan: 04
type: execute
wave: 2
depends_on: [03-02, 03-03, 03-05]
files_modified:
  - plugins/zama-skills/skills/init/scripts/scaffold.ts
  - plugins/zama-skills/skills/init/scripts/lib/manifest.ts
  - plugins/zama-skills/skills/init/scripts/lib/pin-resolver.ts
autonomous: true
requirements: [INIT-02, INIT-03, INIT-06]
must_haves:
  truths:
    - "Running `tsx scaffold.ts --use-case <X> --target <dir>` materializes templates + seed into target dir"
    - "All <!-- @pin:<pkg> --> placeholders are resolved against shared/pinned-versions.json"
    - "Runtime substitutions {{USE_CASE}} and {{USE_CASE_TITLE}} are applied"
    - "Scaffold runs `pnpm install` then `pnpm hardhat compile` from target dir; non-zero exit propagates"
    - "--post-grep mode aborts on any fhevmjs or root-fhevm match"
    - "Aborts (refuses to overwrite) when target dir exists and is non-empty without --force"
    - "Outputs a JSON manifest of files written for closing-summary.ts to consume"
  artifacts:
    - path: "plugins/zama-skills/skills/init/scripts/scaffold.ts"
      provides: "End-to-end scaffold orchestration"
      exports: ["main", "scaffold", "postGrep"]
    - path: "plugins/zama-skills/skills/init/scripts/lib/pin-resolver.ts"
      provides: "Replaces @pin:<pkg> placeholders with versions from pinned-versions.json"
      exports: ["resolvePins"]
    - path: "plugins/zama-skills/skills/init/scripts/lib/manifest.ts"
      provides: "Scaffold manifest type + writer"
      exports: ["ScaffoldManifest", "buildManifest"]
  key_links:
    - from: "scaffold.ts"
      to: "scripts/lib/versions.ts"
      via: "import { getVersion, getCompilerVersion, loadVersions } from '../../../scripts/lib/versions.js'"
      pattern: "scripts/lib/versions"
    - from: "scaffold.ts"
      to: "templates/**/*.tpl"
      via: "fs-extra.copy + content rewrite"
      pattern: "assets/templates"
    - from: "scaffold.ts"
      to: "seeds/<use-case>/*.sol"
      via: "fs-extra.copy"
      pattern: "assets/seeds"
---

<objective>
Implement the runtime scaffold orchestrator. This is the script the SKILL.md invokes via `${CLAUDE_SKILL_DIR}/scripts/scaffold.ts`. It materializes the templates (03-02) and seed (03-03), runs install + compile, and emits a manifest the closing-summary (03-05) consumes.

Purpose: Deterministic, auditable scaffold. No fork-and-post-process. Hand-authored templates resolved at runtime against the single source of truth (pinned-versions.json).
Output: 3 TypeScript files. CLI: `tsx scaffold.ts --use-case <token|voting|auction|custom> --target <dir> [--force] [--no-install] [--no-compile]` and `tsx scaffold.ts --post-grep <dir>`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/03-zama-init-end-to-end/03-CONTEXT.md
@.planning/phases/03-zama-init-end-to-end/ORCHESTRATION.md
@scripts/lib/versions.ts
@scripts/build.ts

<interfaces>
- @pin placeholder regex (reuse from build.ts): `/<!--\s*@pin:([^\s>]+)\s*-->/g`
- Special pins:
  - `@pin:solc` → `getCompilerVersion()` (top-level `compiler.solc` in pinned-versions.json)
  - All others → `getVersion(pkgName)` from `scripts/lib/versions.ts`
- Runtime substitutions (NOT @pin):
  - `{{USE_CASE}}` → e.g. `confidential-token`
  - `{{USE_CASE_TITLE}}` → Title-Cased: `Confidential Token`
- Use-case → seed mapping:
  - `confidential-token` → seeds/confidential-token/Token.sol → packages/contracts/contracts/Token.sol  (+ scripts/register-token.ts → packages/contracts/scripts/register-token.ts)
  - `voting` → seeds/voting/Poll.sol → packages/contracts/contracts/Poll.sol
  - `auction` → seeds/auction/SealedBidAuction.sol → packages/contracts/contracts/SealedBidAuction.sol
  - `custom` → seeds/custom/Skeleton.sol → packages/contracts/contracts/Skeleton.sol
- Template extension stripping: `foo.json.tpl` → `foo.json` at the destination.
- Manifest shape:
  ```ts
  interface ScaffoldManifest {
    useCase: "confidential-token" | "voting" | "auction" | "custom";
    targetDir: string;
    filesWritten: { path: string; bytes: number }[];
    pinsResolved: Record<string, string>;
    commandsRan: { cmd: string; cwd: string; ok: boolean; durationMs: number }[];
    deprecationGrep: { ok: true } | { ok: false; matches: { file: string; line: number; text: string }[] };
  }
  ```
- Risk note (per ORCHESTRATION.md): we do NOT clone fhevm-react-template. Document this in a top-of-file comment in scaffold.ts so future maintainers don't add a clone step blindly.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Pin resolver + manifest helper libs</name>
  <files>
    plugins/zama-skills/skills/init/scripts/lib/pin-resolver.ts,
    plugins/zama-skills/skills/init/scripts/lib/manifest.ts
  </files>
  <action>
**`pin-resolver.ts`**:
- Export `resolvePins(text: string, deps: { getVersion: (k: string) => string; getCompilerVersion: () => string }): { resolved: string; pins: Record<string,string> }`.
- Walk the regex `/<!--\s*@pin:([^\s>]+)\s*-->/g` over `text`.
- For each match, if key === `"solc"`, use `getCompilerVersion()`; if key starts with `@zama-fhe/relayer-sdk-dev`, treat as alias (versions.ts already handles); otherwise `getVersion(key)`.
- Return resolved string + a record of `{key: resolvedVersion}` for the manifest.
- On unknown pin: throw with explicit message `"Unknown @pin reference: <key> in template — add to pinned-versions.json or fix template."`
- Pure function (no fs IO) — easy to unit test in 03-06.

**`manifest.ts`**:
- Export the `ScaffoldManifest` interface (above).
- Export `buildManifest(initial: Partial<ScaffoldManifest>): ScaffoldManifest` with sensible defaults (empty arrays).
- Export `serializeManifest(m: ScaffoldManifest): string` returning compact single-line JSON for stdout consumption by closing-summary.

Both files: strict TS, ESM imports, no top-level side effects.
  </action>
  <verify>
    <automated>
      test -f plugins/zama-skills/skills/init/scripts/lib/pin-resolver.ts && \
      test -f plugins/zama-skills/skills/init/scripts/lib/manifest.ts && \
      grep -q "export function resolvePins" plugins/zama-skills/skills/init/scripts/lib/pin-resolver.ts && \
      grep -q "ScaffoldManifest" plugins/zama-skills/skills/init/scripts/lib/manifest.ts && \
      pnpm exec tsc --noEmit --project tsconfig.json 2>&1 | { ! grep -q "scripts/lib/pin-resolver\|scripts/lib/manifest"; }
    </automated>
  </verify>
  <done>Both libs typecheck clean against the repo tsconfig; resolvePins is pure; manifest exports the documented shape.</done>
</task>

<task type="auto">
  <name>Task 2: scaffold.ts orchestrator (CLI + materialize + install + compile + grep)</name>
  <files>plugins/zama-skills/skills/init/scripts/scaffold.ts</files>
  <action>
Top-of-file comment (15-20 lines) explaining:
1. This script is invoked by SKILL.md via `${CLAUDE_SKILL_DIR}/scripts/scaffold.ts`.
2. We do NOT clone fhevm-react-template at runtime — see ORCHESTRATION.md "React-Template Drift Risk".
3. Templates use @pin: placeholders resolved against shared/pinned-versions.json.

CLI shape (parsed manually with `process.argv`, no external CLI lib needed):
- `--use-case <token|voting|auction|custom>` (or `confidential-token` instead of `token`)
- `--target <dir>` (relative or absolute)
- `--force` (bypass non-empty check)
- `--no-install` / `--no-compile` (escape hatches for tests)
- `--post-grep <dir>` (alternate mode: only run deprecation grep)

**Main flow** (when `--post-grep` NOT set):
1. **Validate args**: use-case required + must be in known set; target dir required.
2. **Resolve target**: if exists & non-empty & no `--force` → exit 1 with explicit message.
3. **Locate plugin root**: walk up from `import.meta.url` to find `pinned-versions.json` (so this script works whether invoked from plugin dir, from CWD, or from `${CLAUDE_SKILL_DIR}` install path).
4. **Load versions**: `loadVersions(...)` from `scripts/lib/versions.ts` (relative import from plugin root).
5. **Walk templates dir** (`assets/templates/**`): for each `.tpl` file:
   - Read content as utf-8.
   - Resolve `@pin:` placeholders via `resolvePins`.
   - Apply runtime substitutions: replace `{{USE_CASE}}` with the use-case slug, `{{USE_CASE_TITLE}}` with Title Case (e.g. "Confidential Token", "Voting", "Auction", "Custom").
   - Compute destination path: strip `.tpl` extension, prepend `<target>` (preserve directory tree under templates/).
   - Special-case dotfiles: `.env.example.tpl` → `.env.example`, `.gitignore.tpl` → `.gitignore`.
   - `fse.outputFile(destPath, resolvedContent)`.
   - Record into manifest.filesWritten.
6. **Copy seed**:
   - Map use-case → seed dir (handle `token` alias → `confidential-token`).
   - Copy `seeds/<use-case>/*.sol` to `<target>/packages/contracts/contracts/`.
   - For `confidential-token`: also copy `seeds/confidential-token/scripts/register-token.ts` to `<target>/packages/contracts/scripts/register-token.ts`.
7. **Run `pnpm install`** in target dir using `node:child_process.spawn` with `stdio: "inherit"`. Skip if `--no-install`. On non-zero exit: record in manifest, print manifest as JSON to stderr, exit 1.
8. **Run `pnpm hardhat compile`** in `<target>/packages/contracts`. Skip if `--no-compile`. On non-zero exit: same handling.
9. **Post-scaffold deprecation grep** (always — belt & suspenders): walk target dir (skip `node_modules`, `.git`, `cache`, `artifacts`), grep for `fhevmjs` or `"fhevm":` (the literal string with the colon — root-pkg dependency entry). Allow matches inside `node_modules/` (excluded above) and inside any single-line `// `-prefixed comment OR multi-line `/* */` block (Skeleton.sol legitimately mentions fhevmjs in a deprecation warning comment). Implementation tip: use a line-based scan and ignore lines whose lstrip starts with `//`, `*`, or `#`. On match: write manifest with `deprecationGrep.ok=false` + matches, exit 1.
10. **Print manifest** to stdout as serialized JSON (single line). Exit 0.

**Post-grep mode** (when `--post-grep <dir>` set):
- Same grep as step 9. Print results JSON. Exit 1 on hit, 0 on clean.

Use `fs-extra` (already in repo deps). Use `picocolors` for terminal output. All non-stdout messages go to stderr (so manifest stdout stays parseable).

Add a guard: if `pinned-versions.json` cannot be located, print actionable error: `"Could not locate pinned-versions.json. Searched up from <cwd>. This script must run from within an installed zama-skills plugin tree."`
  </action>
  <verify>
    <automated>
      test -f plugins/zama-skills/skills/init/scripts/scaffold.ts && \
      grep -q "post-grep" plugins/zama-skills/skills/init/scripts/scaffold.ts && \
      grep -q "resolvePins" plugins/zama-skills/skills/init/scripts/scaffold.ts && \
      grep -q "pnpm install" plugins/zama-skills/skills/init/scripts/scaffold.ts && \
      grep -q "hardhat compile" plugins/zama-skills/skills/init/scripts/scaffold.ts && \
      grep -q "fhevmjs" plugins/zama-skills/skills/init/scripts/scaffold.ts && \
      grep -q "ScaffoldManifest" plugins/zama-skills/skills/init/scripts/scaffold.ts && \
      pnpm exec tsc --noEmit --project tsconfig.json 2>&1 | { ! grep -q "scaffold.ts"; } && \
      pnpm exec tsx plugins/zama-skills/skills/init/scripts/scaffold.ts --post-grep plugins/zama-skills/skills/init/assets/templates ; \
      [ $? -eq 0 ] || { echo "post-grep on clean templates must succeed"; exit 1; }
    </automated>
  </verify>
  <done>scaffold.ts typechecks; CLI parses both modes; post-grep on the in-repo templates dir exits 0 (no deprecation hits in our own templates).</done>
</task>

</tasks>

<verification>
- 3 files exist under `plugins/zama-skills/skills/init/scripts/`.
- Repo tsconfig produces zero errors involving these files.
- Post-grep mode against `plugins/zama-skills/skills/init/assets/templates` exits 0 (templates are clean).
- Post-grep mode against a synthetic file containing `import 'fhevmjs'` exits 1 (asserted in 03-06 unit tests).
- Pin resolver throws on unknown keys (asserted in 03-06).
</verification>

<success_criteria>
- INIT-02 — pinned versions injected from JSON, never hardcoded; templates produce concrete versions in scaffold output.
- INIT-03 — `.env.example.tpl` materialized to `<target>/.env.example`.
- INIT-06 — `pnpm install` + `pnpm hardhat compile` invoked; non-zero exit propagates.
- Belt-and-suspenders deprecation guard: scaffold ABORTS on any fhevmjs/root-fhevm escape.
</success_criteria>

<output>
After completion, create `.planning/phases/03-zama-init-end-to-end/03-04-SUMMARY.md` documenting: CLI flags accepted, manifest schema, plugin-root discovery algorithm, deprecation grep allowlist (comment lines), and any deviations from CONTEXT.md (notably the no-clone-template decision per ORCHESTRATION).
</output>
