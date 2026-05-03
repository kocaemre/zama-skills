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
const MAX_ITERATIONS = 100;

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
 * Iteratively resolve every marker via the resolver callback. Re-parses after each
 * replacement (indices shift). Caps at 100 iterations to detect cycles.
 */
export function replaceAllMarkers(
  text: string,
  resolver: (kind: MarkerKind, name: string) => string,
): string {
  let out = text;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const ms = parseMarkers(out);
    let changed = false;
    for (const mk of ms) {
      const desired = resolver(mk.kind, mk.name);
      const wrapped = `\n${desired.trim()}\n`;
      if (mk.currentBody !== wrapped) {
        out =
          out.slice(0, mk.openEnd) + wrapped + out.slice(mk.closeStart);
        changed = true;
        break;
      }
    }
    if (!changed) return out;
  }
  throw new MarkerError(
    "replaceAllMarkers exceeded 100 iterations — possible cycle in resolver output",
  );
}
