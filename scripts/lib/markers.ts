/**
 * HTML-comment marker parser/replacer for `pnpm sync` transclusion.
 *
 * Marker syntax (uniform open/close):
 *   <!-- @sync:snippet:NAME -->...body...<!-- @endsync -->
 *   <!-- @sync:prompt:NAME -->...body...<!-- @endsync -->
 *   <!-- @sync:shared:NAME -->...body...<!-- @endsync -->
 *
 * Nesting is disallowed; unbalanced markers raise MarkerError.
 */

export type MarkerKind = "snippet" | "prompt" | "shared";

export interface Marker {
  kind: MarkerKind;
  name: string;
  /** Index of "<!--" of opening marker. */
  openStart: number;
  /** Index AFTER closing "-->" of opening marker. */
  openEnd: number;
  /** Index of "<!--" of closing @endsync marker. */
  closeStart: number;
  /** Index AFTER closing "-->" of @endsync marker. */
  closeEnd: number;
  /** Body text between openEnd and closeStart (verbatim). */
  currentBody: string;
}

export class MarkerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarkerError";
  }
}

const OPEN_RE = /<!--\s*@sync:(snippet|prompt|shared):([a-zA-Z0-9_\-]+)\s*-->/g;
const NESTED_OPEN_RE = /<!--\s*@sync:(?:snippet|prompt|shared):/;
const CLOSE_TOKEN = "<!-- @endsync -->";
/** Safety bound on per-marker resolution attempts; unrelated to total marker count. */
const MAX_PER_MARKER_VISITS = 4;

export function parseMarkers(text: string): Marker[] {
  const markers: Marker[] = [];
  const re = new RegExp(OPEN_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const openStart = m.index;
    const openEnd = m.index + m[0].length;
    const kind = m[1] as MarkerKind;
    const name = m[2];
    if (!name) {
      throw new MarkerError(`Malformed @sync marker at offset ${openStart}`);
    }
    const closeStart = text.indexOf(CLOSE_TOKEN, openEnd);
    if (closeStart === -1) {
      throw new MarkerError(
        `Unclosed @sync marker: ${kind}:${name} at offset ${openStart}`,
      );
    }
    const between = text.slice(openEnd, closeStart);
    if (NESTED_OPEN_RE.test(between)) {
      throw new MarkerError(
        `Nested @sync markers not allowed (in ${kind}:${name} at offset ${openStart})`,
      );
    }
    const closeEnd = closeStart + CLOSE_TOKEN.length;
    markers.push({
      kind,
      name,
      openStart,
      openEnd,
      closeStart,
      closeEnd,
      currentBody: between,
    });
    re.lastIndex = closeEnd;
  }
  return markers;
}

export function replaceMarker(
  text: string,
  kind: MarkerKind,
  name: string,
  newBody: string,
): string {
  const markers = parseMarkers(text);
  const target = markers.find((x) => x.kind === kind && x.name === name);
  if (!target) {
    throw new MarkerError(`Marker not found: ${kind}:${name}`);
  }
  const wrapped = `\n${newBody.trim()}\n`;
  return text.slice(0, target.openEnd) + wrapped + text.slice(target.closeStart);
}

/**
 * Resolve every marker via the resolver callback in a single reverse-order pass.
 *
 * Cycle detection is per-marker: each (kind,name) is resolved at most a small
 * number of times. This decouples cycle detection from marker count, so a
 * document with hundreds of distinct markers no longer false-positives. A real
 * cycle (resolver output that itself contains the same marker) trips the
 * per-marker visit cap.
 */
export function replaceAllMarkers(
  text: string,
  resolver: (kind: MarkerKind, name: string) => string,
): string {
  // Per-marker visit counts — keyed by `${kind}:${name}`.
  const visits = new Map<string, number>();
  let out = text;
  // Outer loop bounds total work but is not the cycle-detection signal.
  // Each iteration replaces every marker present at parse time in reverse
  // order (so offsets remain valid). We re-parse afterward to surface any
  // markers introduced by resolver bodies; the per-marker visit cap fires
  // if the same marker keeps re-appearing (true cycle).
  // Hard ceiling on outer rounds — far beyond plausible nesting depth.
  const MAX_ROUNDS = 32;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const ms = parseMarkers(out);
    if (ms.length === 0) return out;
    // Track whether any marker actually needed replacing this round.
    let mutated = false;
    // Replace in reverse order so prior offsets stay valid as we splice.
    for (let i = ms.length - 1; i >= 0; i--) {
      const mk = ms[i]!;
      const key = `${mk.kind}:${mk.name}`;
      const visited = visits.get(key) ?? 0;
      if (visited >= MAX_PER_MARKER_VISITS) {
        throw new MarkerError(
          `Possible cycle in resolver output for marker ${key} (visited ${visited} times)`,
        );
      }
      visits.set(key, visited + 1);
      const desired = resolver(mk.kind, mk.name);
      const wrapped = `\n${desired.trim()}\n`;
      if (mk.currentBody !== wrapped) {
        out = out.slice(0, mk.openEnd) + wrapped + out.slice(mk.closeStart);
        mutated = true;
      }
    }
    if (!mutated) return out;
  }
  throw new MarkerError(
    "replaceAllMarkers exceeded resolution rounds — possible cycle in resolver output",
  );
}
