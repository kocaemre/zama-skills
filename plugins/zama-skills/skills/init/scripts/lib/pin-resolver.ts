/**
 * pin-resolver.ts — pure function that walks `<!-- @pin:<pkg> -->` placeholders
 * in template text and replaces them with concrete versions from
 * `shared/pinned-versions.json` via the injected resolver functions.
 *
 * Pure — no fs/process IO. Easy to unit-test (Plan 03-06).
 *
 * Special cases:
 *   - `@pin:solc`                          → `getCompilerVersion()`
 *   - `@pin:@zama-fhe/relayer-sdk-dev`     → handled transparently by getVersion
 *                                            (alias entry in pinned-versions.json
 *                                            resolves to "0.4.1" exact).
 *
 * Regex matches `scripts/build.ts` (PIN_RE) so a single placeholder vocabulary
 * is shared across the build engine and the runtime scaffolder.
 */

export interface PinResolverDeps {
  getVersion: (pkg: string) => string;
  getCompilerVersion: () => string;
}

export interface PinResolveResult {
  /** Template content with all @pin placeholders replaced. */
  resolved: string;
  /** Map of pin key → resolved version, populated for every successful match. */
  pins: Record<string, string>;
}

const PIN_RE = /<!--\s*@pin:([^\s>]+)\s*-->/g;

/**
 * Replace every `<!-- @pin:<key> -->` in `text`.
 * Throws on the first unknown key with an actionable error.
 */
export function resolvePins(
  text: string,
  deps: PinResolverDeps,
): PinResolveResult {
  const pins: Record<string, string> = {};
  const resolved = text.replace(PIN_RE, (_match, rawKey: string) => {
    const key = rawKey.trim();
    let version: string;
    try {
      if (key === "solc") {
        version = deps.getCompilerVersion();
      } else {
        version = deps.getVersion(key);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Unknown @pin reference: ${key} in template — add to pinned-versions.json or fix template. (${reason})`,
      );
    }
    if (typeof version !== "string" || version.length === 0) {
      throw new Error(
        `Unknown @pin reference: ${key} in template — add to pinned-versions.json or fix template.`,
      );
    }
    pins[key] = version;
    return version;
  });
  return { resolved, pins };
}
