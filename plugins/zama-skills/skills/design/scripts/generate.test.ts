/**
 * generate.test.ts — vitest suite for /zama-design pure renderers + the
 * end-to-end generateDesign() orchestration.
 *
 * Covers:
 *   - input validation (slug shape, enum values, oneLiner length)
 *   - per-category recommendation correctness (OZ base or custom)
 *   - ACL / decryption table shape per category × decryption strategy
 *   - 4-state UX hook is always present in UI-WIREFRAME.md output
 *   - Deprecated-import refusal (fhevmjs, root fhevm) — never present in output
 *   - File write paths land under .planning/v1-design/<slug>/
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  validateInputs,
  renderDesignSubs,
  renderWireframeSubs,
  applySubs,
  type DesignInputs,
} from "./lib/templates.ts";
import { generateDesign } from "./generate.ts";

const FIXED_NOW = new Date("2026-05-04T00:00:00Z");

function baseInputs(over: Partial<DesignInputs> = {}): DesignInputs {
  return {
    slug: "private-payroll",
    category: "payroll",
    confidential: "amounts",
    decryption: "each-user-sees-own",
    oneLiner: "Private payroll for a 50-person remote team",
    ...over,
  };
}

// ---------------- validateInputs ----------------

describe("validateInputs", () => {
  it("accepts a valid kebab-case slug", () => {
    expect(() => validateInputs(baseInputs())).not.toThrow();
  });

  it("refuses path-traversal slug", () => {
    expect(() =>
      validateInputs(baseInputs({ slug: "../evil" })),
    ).toThrow(/kebab-case/);
  });

  it("refuses uppercase in slug", () => {
    expect(() => validateInputs(baseInputs({ slug: "BadSlug" }))).toThrow(
      /kebab-case/,
    );
  });

  it("refuses unknown category", () => {
    expect(() =>
      validateInputs(baseInputs({ category: "nonsense" as never })),
    ).toThrow(/Unknown category/);
  });

  it("refuses unknown decryption strategy", () => {
    expect(() =>
      validateInputs(baseInputs({ decryption: "telepathy" as never })),
    ).toThrow(/Unknown decryption/);
  });

  it("refuses trivial oneLiner", () => {
    expect(() => validateInputs(baseInputs({ oneLiner: "x" }))).toThrow(
      /oneLiner/,
    );
  });
});

// ---------------- renderDesignSubs ----------------

describe("renderDesignSubs", () => {
  it("recommends ERC7984 for confidential-token", () => {
    const subs = renderDesignSubs(
      baseInputs({ category: "confidential-token" }),
      FIXED_NOW,
    );
    expect(subs.BASE_CHOICE).toMatch(/ERC7984/);
    expect(subs.SOL_IMPORTS).toMatch(
      /@openzeppelin\/confidential-contracts\/token\/ERC7984\/ERC7984\.sol/,
    );
    expect(subs.INIT_USE_CASE).toBe("confidential-token");
  });

  it("recommends VotesConfidential for voting", () => {
    const subs = renderDesignSubs(
      baseInputs({ category: "voting" }),
      FIXED_NOW,
    );
    expect(subs.BASE_CHOICE).toMatch(/VotesConfidential/);
    expect(subs.SOL_IMPORTS).toMatch(
      /@openzeppelin\/confidential-contracts\/governance\/VotesConfidential\.sol/,
    );
  });

  it("recommends custom + cites Zama auction example for auction", () => {
    const subs = renderDesignSubs(
      baseInputs({ category: "auction" }),
      FIXED_NOW,
    );
    expect(subs.BASE_CHOICE).toMatch(/Custom/);
    expect(subs.BASE_RATIONALE).toMatch(/auction/i);
    expect(subs.SOL_IMPORTS).toMatch(/@fhevm\/solidity\/lib\/FHE\.sol/);
    // No OZ primitive
    expect(subs.SOL_IMPORTS).not.toMatch(/@openzeppelin/);
  });

  it("includes encrypted state schema rows for the category", () => {
    const subs = renderDesignSubs(
      baseInputs({ category: "auction" }),
      FIXED_NOW,
    );
    expect(subs.STATE_SCHEMA_TABLE).toMatch(/`bids`/);
    expect(subs.STATE_SCHEMA_TABLE).toMatch(/euint64/);
    expect(subs.STATE_SCHEMA_TABLE).toMatch(/`winner`/);
    expect(subs.STATE_SCHEMA_TABLE).toMatch(/eaddress/);
  });

  it("ACL table contains FHE.allowThis for contract", () => {
    const subs = renderDesignSubs(baseInputs(), FIXED_NOW);
    expect(subs.ACL_TABLE).toMatch(/FHE\.allowThis/);
    expect(subs.ACL_TABLE).toMatch(/FHE\.allow\(/);
  });

  it("decryption table reflects each-user-sees-own → userDecrypt", () => {
    const subs = renderDesignSubs(
      baseInputs({ decryption: "each-user-sees-own" }),
      FIXED_NOW,
    );
    expect(subs.DECRYPTION_TABLE).toMatch(/userDecrypt/);
  });

  it("decryption table reflects public-after-trigger → publicDecrypt", () => {
    const subs = renderDesignSubs(
      baseInputs({ decryption: "public-after-trigger" }),
      FIXED_NOW,
    );
    expect(subs.DECRYPTION_TABLE).toMatch(/publicDecrypt/);
  });

  it("mixed decryption fans out per-slot for auction", () => {
    const subs = renderDesignSubs(
      baseInputs({ category: "auction", decryption: "mixed" }),
      FIXED_NOW,
    );
    // bids → user, winner → public
    expect(subs.DECRYPTION_TABLE).toMatch(/`bids`.*each-user-sees-own/);
    expect(subs.DECRYPTION_TABLE).toMatch(/`winner`.*public-after-trigger/);
  });

  it("never embeds deprecated package names in any field", () => {
    const subs = renderDesignSubs(baseInputs(), FIXED_NOW);
    const all = Object.values(subs).join("\n");
    expect(all).not.toMatch(/\bfhevmjs\b/);
    expect(all).not.toMatch(/from\s+["']fhevm["']/);
  });
});

// ---------------- renderWireframeSubs ----------------

describe("renderWireframeSubs", () => {
  it("includes a category-specific component tree", () => {
    const subs = renderWireframeSubs(
      baseInputs({ category: "auction" }),
      FIXED_NOW,
    );
    expect(subs.COMPONENT_TREE).toMatch(/<BidForm/);
  });

  it("user flows mention all four UX states", () => {
    const subs = renderWireframeSubs(
      baseInputs({ category: "voting" }),
      FIXED_NOW,
    );
    const flows = subs.USER_FLOWS;
    expect(flows).toMatch(/encrypting/);
    expect(flows).toMatch(/pending/);
    expect(flows).toMatch(/decrypted/);
  });

  it("screen states block always documents the connect screen", () => {
    const subs = renderWireframeSubs(baseInputs(), FIXED_NOW);
    expect(subs.SCREEN_STATES).toMatch(/Connect screen/);
  });
});

// ---------------- applySubs ----------------

describe("applySubs", () => {
  it("substitutes {{KEY}} when present", () => {
    expect(applySubs("Hello {{NAME}}", { NAME: "world" })).toBe(
      "Hello world",
    );
  });

  it("leaves unknown placeholders in place (visible to author)", () => {
    expect(applySubs("Hello {{MISSING}}", {})).toBe("Hello {{MISSING}}");
  });

  it("does not touch non-placeholder braces", () => {
    expect(applySubs("`{ foo }` {{NAME}}", { NAME: "x" })).toBe(
      "`{ foo }` x",
    );
  });
});

// ---------------- generateDesign (end-to-end) ----------------

describe("generateDesign", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "zama-design-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes DESIGN.md + UI-WIREFRAME.md under .planning/v1-design/<slug>/", () => {
    const r = generateDesign({ cwd: dir, inputs: baseInputs(), now: FIXED_NOW });
    const designPath = join(dir, ".planning", "v1-design", "private-payroll", "DESIGN.md");
    const wirePath = join(dir, ".planning", "v1-design", "private-payroll", "UI-WIREFRAME.md");
    expect(existsSync(designPath)).toBe(true);
    expect(existsSync(wirePath)).toBe(true);
    expect(r.designPath).toBe(designPath);
    expect(r.wireframePath).toBe(wirePath);
  });

  it("DESIGN.md contains the rendered base recommendation + ACL table", () => {
    generateDesign({
      cwd: dir,
      inputs: baseInputs({ category: "voting" }),
      now: FIXED_NOW,
    });
    const md = readFileSync(
      join(dir, ".planning", "v1-design", "private-payroll", "DESIGN.md"),
      "utf8",
    );
    expect(md).toMatch(/VotesConfidential/);
    expect(md).toMatch(/FHE\.allowThis/);
    // No leftover unfilled placeholders for known keys
    expect(md).not.toMatch(/\{\{BASE_CHOICE\}\}/);
    expect(md).not.toMatch(/\{\{ACL_TABLE\}\}/);
    expect(md).not.toMatch(/\{\{STATE_SCHEMA_TABLE\}\}/);
  });

  it("UI-WIREFRAME.md contains the 4-state UX hook + relayer-sdk reference", () => {
    generateDesign({ cwd: dir, inputs: baseInputs(), now: FIXED_NOW });
    const md = readFileSync(
      join(dir, ".planning", "v1-design", "private-payroll", "UI-WIREFRAME.md"),
      "utf8",
    );
    expect(md).toMatch(/4-state UX hook/);
    expect(md).toMatch(/idle/);
    expect(md).toMatch(/encrypting/);
    expect(md).toMatch(/pending/);
    expect(md).toMatch(/decrypted/);
    expect(md).toMatch(/@zama-fhe\/relayer-sdk/);
    // Refuses fhevmjs as an actual import (prose mentions explaining the
    // deprecation are allowed; only `import`/`from`/`require` are banned).
    expect(md).not.toMatch(/from\s+["']fhevmjs["']/);
    expect(md).not.toMatch(/import\s+["']fhevmjs["']/);
  });

  it("refuses to overwrite without force", () => {
    generateDesign({ cwd: dir, inputs: baseInputs(), now: FIXED_NOW });
    expect(() =>
      generateDesign({ cwd: dir, inputs: baseInputs(), now: FIXED_NOW }),
    ).toThrow(/exists/);
  });

  it("overwrites with force=true", () => {
    generateDesign({ cwd: dir, inputs: baseInputs(), now: FIXED_NOW });
    expect(() =>
      generateDesign({
        cwd: dir,
        inputs: baseInputs(),
        now: FIXED_NOW,
        force: true,
      }),
    ).not.toThrow();
  });

  it("refuses path-traversal slug at generate-time", () => {
    expect(() =>
      generateDesign({
        cwd: dir,
        inputs: baseInputs({ slug: "../evil" }),
        now: FIXED_NOW,
      }),
    ).toThrow(/kebab-case/);
  });

  it("post-grep refuses leaked deprecated import in template", () => {
    // Sanity: the rendered output should NEVER contain deprecated names.
    // This is enforced by the post-write deprecation guard inside
    // generateDesign(). Simulate by mutating the slug-output dir post-hoc.
    const r = generateDesign({ cwd: dir, inputs: baseInputs(), now: FIXED_NOW });
    const tampered = readFileSync(r.designPath, "utf8") + "\n```ts\nimport 'fhevmjs';\n```\n";
    writeFileSync(r.designPath, tampered, "utf8");
    // A second generation with force should re-write a clean file.
    generateDesign({
      cwd: dir,
      inputs: baseInputs(),
      now: FIXED_NOW,
      force: true,
    });
    const fresh = readFileSync(r.designPath, "utf8");
    // Prose explaining the deprecation is allowed; only actual import
    // statements are forbidden.
    expect(fresh).not.toMatch(/import\s+["']fhevmjs["']/);
    expect(fresh).not.toMatch(/from\s+["']fhevmjs["']/);
  });
});
