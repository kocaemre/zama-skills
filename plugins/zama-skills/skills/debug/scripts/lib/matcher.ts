/**
 * matcher.ts — pattern matching engine for /zama-debug.
 *
 * Given pasted error text and the registered PATTERNS, return the first
 * matching diagnosis (or null). First-match-wins keeps behaviour
 * deterministic and trivially extensible: place more specific patterns
 * earlier in `PATTERNS`.
 */

import type { DebugPattern } from "./patterns.ts";
import { PATTERNS } from "./patterns.ts";

export interface DiagnosisResult {
  matched: true;
  pattern: DebugPattern;
}

export interface NoMatchResult {
  matched: false;
}

export type MatchResult = DiagnosisResult | NoMatchResult;

/**
 * Match the given error text against the registered patterns.
 *
 * Returns `{ matched: true, pattern }` on first hit, or
 * `{ matched: false }` if nothing matches. Empty / whitespace-only input
 * never matches.
 */
export function diagnose(
  errorText: string,
  patterns: readonly DebugPattern[] = PATTERNS,
): MatchResult {
  if (typeof errorText !== "string" || errorText.trim().length === 0) {
    return { matched: false };
  }

  for (const p of patterns) {
    if (p.pattern.test(errorText)) {
      return { matched: true, pattern: p };
    }
  }
  return { matched: false };
}

/**
 * Render a diagnosis result as plain markdown, suitable for printing to a
 * terminal or Claude Code chat. Keeps formatting stable across all 10
 * patterns so the SKILL.md output is predictable.
 */
export function renderDiagnosis(result: MatchResult): string {
  if (!result.matched) {
    return [
      "## /zama-debug — no match",
      "",
      "No registered pattern matched the supplied error text.",
      "",
      "Next steps:",
      "- Re-paste the **full** error including stack frames (truncating loses signal).",
      "- Search Zama docs: https://docs.zama.org/protocol",
      "- Query context7 directly: `mcp__context7__get-library-docs` with `/zama-ai/fhevm` and a tighter `topic`.",
      "- Open an issue with the full trace if it looks like a real bug.",
      "",
    ].join("\n");
  }

  const { pattern } = result;
  const fixLines = pattern.fix.map((line, i) => `${i + 1}. ${line}`).join("\n");
  return [
    `## /zama-debug — ${pattern.label}`,
    "",
    `**Pattern:** \`${pattern.name}\``,
    "",
    "### Likely cause",
    "",
    pattern.cause,
    "",
    "### Fix",
    "",
    fixLines,
    "",
    "### Reference",
    "",
    `- ${pattern.reference}`,
    "",
  ].join("\n");
}
