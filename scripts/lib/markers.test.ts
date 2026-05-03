import { describe, it, expect } from "vitest";
import {
  parseMarkers,
  replaceMarker,
  replaceAllMarkers,
  MarkerError,
} from "./markers.js";

describe("parseMarkers", () => {
  it("parses a single snippet marker with body", () => {
    const text =
      "before <!-- @sync:snippet:foo -->old body<!-- @endsync --> after";
    const ms = parseMarkers(text);
    expect(ms).toHaveLength(1);
    expect(ms[0]?.kind).toBe("snippet");
    expect(ms[0]?.name).toBe("foo");
    expect(ms[0]?.currentBody).toBe("old body");
  });

  it("parses prompt and shared kinds", () => {
    const t = `<!-- @sync:prompt:p1 -->A<!-- @endsync -->
<!-- @sync:shared:context7-query -->B<!-- @endsync -->`;
    const ms = parseMarkers(t);
    expect(ms.map((m) => m.kind)).toEqual(["prompt", "shared"]);
    expect(ms.map((m) => m.name)).toEqual(["p1", "context7-query"]);
  });

  it("parses multiple markers in one document", () => {
    const t = `<!-- @sync:snippet:a -->X<!-- @endsync -->
mid
<!-- @sync:snippet:b -->Y<!-- @endsync -->`;
    const ms = parseMarkers(t);
    expect(ms).toHaveLength(2);
    expect(ms[0]?.name).toBe("a");
    expect(ms[1]?.name).toBe("b");
  });

  it("accepts hyphenated and underscored names", () => {
    const t = `<!-- @sync:snippet:versions-table -->x<!-- @endsync --><!-- @sync:prompt:anti_dep -->y<!-- @endsync -->`;
    const ms = parseMarkers(t);
    expect(ms[0]?.name).toBe("versions-table");
    expect(ms[1]?.name).toBe("anti_dep");
  });

  it("throws MarkerError on unbalanced (unclosed) marker", () => {
    const t = "before <!-- @sync:snippet:foo -->no end here";
    expect(() => parseMarkers(t)).toThrow(MarkerError);
  });

  it("throws MarkerError on nested markers", () => {
    const t =
      "<!-- @sync:snippet:outer --><!-- @sync:snippet:inner -->z<!-- @endsync --><!-- @endsync -->";
    expect(() => parseMarkers(t)).toThrow(MarkerError);
  });

  it("returns empty array for text with no markers", () => {
    expect(parseMarkers("just plain text")).toEqual([]);
  });
});

describe("replaceMarker", () => {
  it("replaces body, preserves marker comments", () => {
    const t = "x <!-- @sync:snippet:foo -->old<!-- @endsync --> y";
    const out = replaceMarker(t, "snippet", "foo", "NEW");
    expect(out).toContain("<!-- @sync:snippet:foo -->");
    expect(out).toContain("<!-- @endsync -->");
    expect(out).toContain("NEW");
    expect(out).not.toContain("old");
  });

  it("throws if marker name not found", () => {
    const t = "<!-- @sync:snippet:foo -->x<!-- @endsync -->";
    expect(() => replaceMarker(t, "snippet", "bar", "z")).toThrow(MarkerError);
  });

  it("does not match wrong kind for same name", () => {
    const t = "<!-- @sync:snippet:foo -->x<!-- @endsync -->";
    expect(() => replaceMarker(t, "prompt", "foo", "z")).toThrow(MarkerError);
  });
});

describe("replaceAllMarkers", () => {
  it("resolves every marker via callback", () => {
    const t = `<!-- @sync:snippet:a -->old<!-- @endsync -->
<!-- @sync:prompt:b -->old<!-- @endsync -->`;
    const out = replaceAllMarkers(t, (kind, name) => `${kind}:${name}-resolved`);
    expect(out).toContain("snippet:a-resolved");
    expect(out).toContain("prompt:b-resolved");
  });

  it("is idempotent — running twice yields same result", () => {
    const t = `<!-- @sync:snippet:a -->stale<!-- @endsync -->`;
    const once = replaceAllMarkers(t, () => "FRESH");
    const twice = replaceAllMarkers(once, () => "FRESH");
    expect(once).toBe(twice);
  });

  it("throws if iteration cap exceeded (cycle)", () => {
    let i = 0;
    const t = `<!-- @sync:snippet:a -->x<!-- @endsync -->`;
    expect(() => replaceAllMarkers(t, () => `gen${i++}`)).toThrow(MarkerError);
  });
});
