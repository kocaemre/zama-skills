---
phase: 02-shared-infrastructure
reviewed: 2026-05-03T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - scripts/build.ts
  - scripts/validate.ts
  - scripts/lib/markers.ts
  - scripts/lib/markers.test.ts
  - scripts/lib/versions.ts
  - scripts/lib/versions.test.ts
  - scripts/lib/generic.ts
  - plugins/zama-skills/shared/pinned-versions.json
  - plugins/zama-skills/shared/deprecated-imports.json
findings:
  critical: 0
  high: 2
  medium: 4
  low: 3
  total: 9
status: findings_found
---

# Phase 2: Code Review Report

## HIGH

### HR-01: `replaceAllMarkers` iteration cap collides with marker count (BLOCKER)
**File:** `scripts/lib/markers.ts:104-122`
**Issue:** Loop replaces only one marker per iteration (`break` after first `changed`). `MAX_ITERATIONS = 100` is the same number as the per-doc marker budget. Any SKILL.md with ≥100 markers needing initial population will throw `MarkerError("possible cycle")` — a false positive indistinguishable from a real cycle. Additionally, even with <100 markers the algorithm is O(N²) re-parses; the convergence/cycle conflation is the actual defect.
**Fix:** Either (a) replace all markers in a single pass using offsets from one `parseMarkers` call (replacing in reverse order so indices stay valid), or (b) decouple cycle detection — track per-marker visit count rather than total iterations:
```ts
const visited = new Map<string, string>();
// after resolving (kind,name), if visited.get(key) was set to a different value than `desired`, throw cycle
```

### HR-02: Silent fallback in `resolvePinPlaceholders` defeats `--check` drift detection
**File:** `scripts/build.ts:78-86`
**Issue:** Unknown package names get replaced with `<!-- @pin:foo (unresolved) -->`. Output is stable across runs, so `--check` reports clean. A typo in a `@pin:` reference will silently ship an "unresolved" comment into SKILL.md instead of failing the build.
**Fix:** Push the failure into `result.errors` (or throw):
```ts
function resolvePinPlaceholders(text: string, errors: string[]): string {
  return text.replace(PIN_RE, (_m, pkg: string) => {
    try { return getVersion(pkg); }
    catch { errors.push(`Unknown @pin package: ${pkg}`); return _m; }
  });
}
```

## MEDIUM

### MR-01: Naive YAML frontmatter parser produces misleading validation errors
**File:** `scripts/validate.ts:95-120`
**Issue:** The line-based parser silently drops list/multiline values. A skill author writing `allowed-tools:\n  - Read\n  - Write` (valid YAML) parses to empty string and fails Zod with `allowed-tools must be a non-empty whitelist` — a confusing error pointing at content, not format.
**Fix:** Either (a) add a project skill rule requiring inline string format, or (b) use a real YAML parser (`yaml` is ~30KB). Minimum: detect list syntax and emit `frontmatter parser does not support YAML lists; use comma-separated string`.

### MR-02: `JSON.stringify(obj, null, 2) + "\n"` forces formatting on `examples/*/package.json`
**File:** `scripts/build.ts:191`
**Issue:** Hard-codes 2-space indent and trailing newline. If a downstream user runs Prettier with `--tab-width 4` or no trailing newline, every `pnpm sync` rewrites the file, every `pnpm validate --check` flags drift. Locks formatting choice into infrastructure.
**Fix:** Detect existing indent (sniff first indented line) or document the constraint loudly and validate it on read.

### MR-03: `loadVersions(customPath)` mutates module-level cache
**File:** `scripts/lib/versions.ts:47-54`
**Issue:** Calling `loadVersions("/some/fixture.json")` overwrites `_versions`, so the next `getVersion(...)` call from production code returns fixture data. Tests mitigate via `_resetCache()`, but the API itself is a footgun for any future consumer that wants to inspect a path without poisoning state.
**Fix:** Only cache when called with the default path:
```ts
export function loadVersions(path?: string): Versions {
  const target = path ?? resolve(SHARED_DIR, "pinned-versions.json");
  const parsed = VersionsSchema.parse(JSON.parse(readFileSync(target, "utf8")));
  if (!path) _versions = parsed;
  return parsed;
}
```

### MR-04: `JSON.parse(readFileSync(...))` lacks file-context error wrapping
**File:** `scripts/lib/versions.ts:50, 59`; `scripts/validate.ts:141, 162`
**Issue:** Malformed JSON throws `SyntaxError: Unexpected token` with no filename — opaque in CI logs.
**Fix:** Wrap in try/catch and rethrow with file path: `throw new Error(\`Invalid JSON in ${path}: ${err.message}\`)`.

## LOW

### LR-01: Dead ternary branches
**File:** `scripts/build.ts:265`
**Issue:** `basename(e) === e ? e : e` — both branches identical. Likely a refactor leftover.
**Fix:** Replace with `console.error(pc.red(\`  - ${e}\`));`.

### LR-02: Fragile direct-invocation detection
**File:** `scripts/build.ts:281-285`; `scripts/validate.ts:254-258`
**Issue:** `arg1.endsWith("build.ts")` matches any file path ending with `build.ts` (e.g., a user's `my-build.ts` that imports from this module would trigger auto-run on import).
**Fix:** Use `import.meta.url` comparison or check for full segment match: `arg1 === fileURLToPath(import.meta.url)`.

### LR-03: `.claude-plugin` directory check fails on macOS dev boxes
**File:** `scripts/validate.ts:174-179`
**Issue:** Stray `.DS_Store` files cause `pluginCpEntries.length !== 1` to fire with confusing error.
**Fix:** Filter dotfiles before the length check, or special-case `.DS_Store`.

---

_Reviewed: 2026-05-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
