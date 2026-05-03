---
phase: 02-shared-infrastructure
plan: 03
type: execute
wave: 2
depends_on: [02-01-pinned-versions, 02-02-shared-content]
files_modified:
  - scripts/lib/markers.ts
  - scripts/lib/markers.test.ts
  - scripts/build.ts
  - scripts/lib/generic.ts
autonomous: true
requirements: [SHARED-04]
must_haves:
  truths:
    - "Running `tsx scripts/build.ts` materializes every `<!-- @sync:snippet:NAME -->...<!-- @endsync -->` marker in SKILL.md files with the corresponding shared/snippets/NAME.md content"
    - "Running `tsx scripts/build.ts --check` exits 0 if no drift, 1 if drift, with a clear diff message"
    - "Running `tsx scripts/build.ts` regenerates `generic/<skill>.md` files from each SKILL.md (stripping frontmatter, expanding markers)"
    - "examples/*/package.json (when present) gets its fhEVM/OZ/Hardhat deps rewritten from pinned-versions.json"
  artifacts:
    - path: "scripts/lib/markers.ts"
      provides: "Marker parser/replacer (parse, replace, extract)"
      exports: ["parseMarkers", "replaceMarker", "MarkerError"]
    - path: "scripts/build.ts"
      provides: "Sync engine: transclusion + generic gen + examples version sync + --check mode"
      exports: ["main", "runSync"]
    - path: "scripts/lib/generic.ts"
      provides: "SKILL.md → generic/<skill>.md generator"
      exports: ["generateGenericFromSkill"]
  key_links:
    - from: "scripts/build.ts"
      to: "scripts/lib/markers.ts"
      via: "import parseMarkers, replaceMarker"
      pattern: "from \"\\./lib/markers"
    - from: "scripts/build.ts"
      to: "scripts/lib/versions.ts"
      via: "import getVersion, isDeprecated"
      pattern: "from \"\\./lib/versions"
    - from: "scripts/build.ts"
      to: "plugins/zama-skills/shared/snippets/"
      via: "fs.readFile per snippet name"
      pattern: "shared/snippets/"
---

<objective>
Implement the sync engine that transcludes shared snippets/prompts into SKILL.md files, regenerates generic markdown rehberler, and rewrites pinned versions inside example package.json files. Provide a `--check` mode for CI drift detection.

Purpose: This is the "single command rebuild" that makes Phase 2's promise real. Without this, all the shared/ content is dead code.

Output: Fully working `pnpm sync` and `pnpm sync --check` (npm scripts wired in plan 02-05).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/phases/02-shared-infrastructure/02-CONTEXT.md
@scripts/validate.ts
@scripts/lib/versions.ts

<interfaces>
<!-- From plan 02-01 (Wave 1) -->
From `scripts/lib/versions.ts`:
```typescript
export function getVersion(pkg: string): string;
export function isDeprecated(pkg: string): { deprecated: boolean; replaces?: string; reason?: string };
export function getCompilerVersion(): string;
export function listAllPackages(): string[];
export function loadVersions(path?: string): Versions;
export function loadDeprecated(path?: string): Deprecated;
```

<!-- Existing dependencies -->
- fs-extra ^11.2.0 (recursive copy + readFile)
- picocolors ^1.1.1 (colored output)
- zod ^3.25.0 (schema validation, available transitively)

<!-- File layout (post Wave 1) -->
- plugins/zama-skills/shared/pinned-versions.json
- plugins/zama-skills/shared/deprecated-imports.json
- plugins/zama-skills/shared/context7-query.md
- plugins/zama-skills/shared/snippets/{versions-table,deprecation-guard,acl-tip,sepolia-faucet}.md
- plugins/zama-skills/shared/prompts/{anti-deprecation,decryption-paths,closing-summary}.md
- plugins/zama-skills/skills/{init,contract,test,deploy,frontend}/SKILL.md (Phase 1 skeletons)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement scripts/lib/markers.ts (HTML comment marker parser/replacer)</name>
  <files>scripts/lib/markers.ts, scripts/lib/markers.test.ts</files>
  <behavior>
    - parseMarkers("text with <!-- @sync:snippet:foo -->old<!-- @endsync --> done") returns one Marker { name: "foo", start, end, currentBody: "old" }
    - parseMarkers handles multiple markers in one document
    - parseMarkers throws MarkerError on unbalanced markers (open with no @endsync)
    - parseMarkers throws MarkerError on nested markers (currently disallowed)
    - replaceMarker(text, "foo", "newBody") returns text with the body between foo's markers replaced; preserves the marker comments themselves
    - replaceMarker throws if marker name not found
    - Marker syntax accepts: `<!-- @sync:snippet:NAME -->` and `<!-- @sync:prompt:NAME -->` and `<!-- @sync:shared:NAME -->` (for context7-query.md). The kind is captured.
  </behavior>
  <action>
    Create `scripts/lib/markers.ts` exporting:

    ```typescript
    export type MarkerKind = "snippet" | "prompt" | "shared";

    export interface Marker {
      kind: MarkerKind;
      name: string;
      openStart: number;   // index of "<!--"
      openEnd: number;     // index AFTER closing "-->" of the open marker
      closeStart: number;  // index of "<!--" of @endsync
      closeEnd: number;    // index AFTER closing "-->" of @endsync
      currentBody: string; // text between openEnd and closeStart
    }

    export class MarkerError extends Error {
      constructor(message: string) { super(message); this.name = "MarkerError"; }
    }

    const OPEN_RE = /<!--\s*@sync:(snippet|prompt|shared):([a-zA-Z0-9_\-]+)\s*-->/g;
    const CLOSE_TOKEN = "<!-- @endsync -->";

    export function parseMarkers(text: string): Marker[] {
      const markers: Marker[] = [];
      OPEN_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = OPEN_RE.exec(text)) !== null) {
        const openStart = m.index;
        const openEnd = m.index + m[0].length;
        const kind = m[1] as MarkerKind;
        const name = m[2];
        // Find next @endsync (no nesting allowed)
        const nextOpen = OPEN_RE.lastIndex;
        const closeStart = text.indexOf(CLOSE_TOKEN, openEnd);
        if (closeStart === -1) {
          throw new MarkerError(`Unclosed @sync marker: ${kind}:${name} at offset ${openStart}`);
        }
        // Detect nesting: if another open marker appears before close
        const nestedOpenMatch = text.slice(openEnd, closeStart).match(/<!--\s*@sync:(snippet|prompt|shared):/);
        if (nestedOpenMatch) {
          throw new MarkerError(`Nested @sync markers not allowed (in ${kind}:${name})`);
        }
        const closeEnd = closeStart + CLOSE_TOKEN.length;
        markers.push({ kind, name, openStart, openEnd, closeStart, closeEnd, currentBody: text.slice(openEnd, closeStart) });
        OPEN_RE.lastIndex = closeEnd;
      }
      return markers;
    }

    export function replaceMarker(text: string, kind: MarkerKind, name: string, newBody: string): string {
      const markers = parseMarkers(text);
      const target = markers.find(x => x.kind === kind && x.name === name);
      if (!target) throw new MarkerError(`Marker not found: ${kind}:${name}`);
      // Surround with newlines so transcluded content reads cleanly
      const wrapped = `\n${newBody.trim()}\n`;
      return text.slice(0, target.openEnd) + wrapped + text.slice(target.closeStart);
    }

    export function replaceAllMarkers(text: string, resolver: (kind: MarkerKind, name: string) => string): string {
      // Multi-pass replacement; resolve each marker via callback. Iterate by re-parsing after each replace
      // because indices shift. Cap iterations to detect infinite loops.
      let out = text;
      const seen = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const ms = parseMarkers(out);
        // Find first marker whose currentBody differs from desired
        let changed = false;
        for (const mk of ms) {
          const desired = resolver(mk.kind, mk.name);
          const wrapped = `\n${desired.trim()}\n`;
          if (mk.currentBody !== wrapped) {
            out = out.slice(0, mk.openEnd) + wrapped + out.slice(mk.closeStart);
            changed = true;
            break;
          }
        }
        if (!changed) return out;
      }
      throw new MarkerError("replaceAllMarkers exceeded 100 iterations — possible cycle");
    }
    ```

    Create `scripts/lib/markers.test.ts` with vitest tests covering all behaviors listed.
  </action>
  <verify>
    <automated>pnpm vitest run scripts/lib/markers.test.ts</automated>
  </verify>
  <done>
    All vitest tests pass. parseMarkers detects all three kinds. replaceMarker preserves marker comments and replaces body only. Nested/unclosed markers throw MarkerError.
  </done>
</task>

<task type="auto">
  <name>Task 2: Implement scripts/lib/generic.ts and scripts/build.ts</name>
  <files>scripts/lib/generic.ts, scripts/build.ts</files>
  <action>
    **`scripts/lib/generic.ts`** — Convert a SKILL.md (post-marker-expansion) to its `generic/<skill>.md` counterpart:
    - Strip the YAML frontmatter (everything between leading `---` and the next `---`).
    - Prepend a header: `> Auto-generated from plugins/zama-skills/skills/<name>/SKILL.md — do not edit manually. Run \`pnpm sync\` to regenerate.`
    - Write the result. Export `generateGenericFromSkill(skillName: string, skillContent: string): string`.

    **`scripts/build.ts`** — The full sync engine. Public API:
    - `runSync(opts: { check: boolean }): Promise<{ changed: string[]; errors: string[] }>`
    - When `check=true`: do everything in-memory, compare against on-disk file content; if any differ, push to `errors` and return non-zero exit code.
    - When `check=false`: write changes; report changed files via picocolors-coloured log.

    Pipeline (in order):

    1. **Load shared content** — call `loadVersions()` and `loadDeprecated()` from versions.ts. Pre-read all snippet files (`shared/snippets/*.md`), all prompt files (`shared/prompts/*.md`), and `shared/context7-query.md` into a Map<string, string>.

    2. **Resolve marker → content function:**
       ```typescript
       function resolve(kind: MarkerKind, name: string): string {
         if (kind === "snippet") return readShared(`snippets/${name}.md`);
         if (kind === "prompt") return readShared(`prompts/${name}.md`);
         if (kind === "shared") return readShared(`${name}.md`); // for context7-query
         throw new Error(`Unknown marker kind: ${kind}`);
       }
       ```

    3. **For each SKILL.md** under `plugins/zama-skills/skills/*/SKILL.md`:
       - Read file.
       - Apply `replaceAllMarkers(content, resolve)`.
       - Compare to disk; if diff and not check-mode, write. If diff and check-mode, record error.

    4. **Regenerate generic markdown:** For each updated SKILL.md, run `generateGenericFromSkill` and write/compare `generic/<skillName>.md` (in repo root `generic/` directory).

    5. **Sync example package.json files:** Glob `examples/*/package.json` (use fs-extra). For each:
       - Read JSON.
       - For every key in `dependencies` and `devDependencies` that is also in pinned-versions.json `packages`, overwrite the value with `getVersion(pkg)`.
       - For `incompatible` packages found in deprecated-imports.json: emit a warning (do not auto-remove — that's the human's call).
       - For `deprecated` packages found: hard error — fail sync. Output: `Drift error: examples/<x>/package.json imports deprecated package <pkg>; replace with <replaces>`.
       - Write back JSON if changed (or compare in check mode). Preserve original key order via stable JSON serialization (use `JSON.stringify(obj, null, 2)` with key-preservation: read object, mutate in-place, stringify).

    6. **Sync `examples/*/hardhat.config.ts`:** Optional — if a marker exists in those files (`<!-- @sync:snippet:solc-version -->`), apply via `replaceAllMarkers`. If no markers, skip silently.

    7. **CLI entrypoint:**
       ```typescript
       const args = process.argv.slice(2);
       const check = args.includes("--check");
       runSync({ check }).then((res) => {
         if (res.errors.length > 0) {
           console.error(pc.red(`Drift detected (${res.errors.length} files):`));
           res.errors.forEach(e => console.error(pc.red(`  - ${e}`)));
           console.error(pc.yellow(`\nRun \`pnpm sync\` and commit the result.`));
           process.exit(1);
         }
         if (check) console.log(pc.green(`✓ No drift across ${res.changed.length} sync targets`));
         else console.log(pc.green(`✓ Synced ${res.changed.length} file(s)`));
       });
       ```

    8. Use `picocolors` for output. Keep total LOC under ~300 (per CONTEXT.md guidance — readability over cleverness).

    Important: in check mode, NEVER write to disk; only compare in-memory rendered content with on-disk content. Use stable string comparison.

    NOTE on generic/ directory: Phase 1 may not have created `generic/`. Build script must `mkdir -p generic/` (use fs-extra `ensureDir`).

    NOTE on examples/: If `examples/` directory does not exist yet, skip steps 5-6 silently (this is normal pre-Phase-5).
  </action>
  <verify>
    <automated>tsx scripts/build.ts --check 2>&1 | tee /tmp/build-check.log; ec=$?; if [ -f plugins/zama-skills/skills/init/SKILL.md ] && grep -q '@sync:' plugins/zama-skills/skills/init/SKILL.md; then [ $ec -eq 1 ] || (echo "Expected drift exit code 1 since markers not yet materialized" && exit 1); else [ $ec -eq 0 ] || (echo "Expected exit 0 when no markers exist yet" && exit 1); fi</automated>
  </verify>
  <done>
    `scripts/build.ts` and `scripts/lib/generic.ts` exist; running `tsx scripts/build.ts --check` exits with informative output; running `tsx scripts/build.ts` (write mode) creates `generic/` directory and writes generic/<skill>.md for each SKILL.md found. Total LOC across both files <300. `pnpm typecheck` passes.
  </done>
</task>

</tasks>

<verification>
1. `pnpm vitest run scripts/lib/markers.test.ts` all green.
2. `pnpm typecheck` zero errors.
3. `tsx scripts/build.ts --help 2>&1 || tsx scripts/build.ts --check` runs without uncaught exceptions.
4. `wc -l scripts/build.ts scripts/lib/generic.ts scripts/lib/markers.ts` total < 600 LOC (script kept readable).
5. After running `tsx scripts/build.ts` write-mode, `ls generic/` shows at least one `.md` file (one per SKILL.md found).
</verification>

<success_criteria>
- Marker parser handles all three kinds, errors on malformed input.
- build.ts performs all 4 sync steps (SKILL.md transclusion, generic gen, examples package.json sync, optional hardhat.config sync).
- --check mode is read-only and exits 1 on drift.
- Deprecated package in examples/* triggers a hard error with replacement guidance.
</success_criteria>

<output>
Create `.planning/phases/02-shared-infrastructure/02-03-SUMMARY.md` listing the marker syntax (so plan 02-04 can use it correctly), the resolve() rules, and any examples/* edge cases handled.
</output>
</content>
</invoke>