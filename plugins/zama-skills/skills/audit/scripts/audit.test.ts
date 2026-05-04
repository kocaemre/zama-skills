/**
 * audit.test.ts — vitest suite for the four FHE-aware checkers and the
 * end-to-end audit orchestrator.
 *
 * Plan v1.1-skills audit, Task 8.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { checkAcl } from "./lib/acl-checker.ts";
import { checkCleartext } from "./lib/cleartext-checker.ts";
import { checkHcu } from "./lib/hcu-counter.ts";
import { checkDeprecations } from "./lib/deprecation-grep.ts";
import { renderReport } from "./lib/report.ts";
import { runAudit } from "./audit.ts";

const FIX_DIR = resolve(__dirname, "__fixtures__");

function load(name: string): string {
  return readFileSync(resolve(FIX_DIR, name), "utf8");
}

// ---------------- ACL checker ----------------
describe("checkAcl", () => {
  it("flags storage write without FHE.allowThis (positive)", () => {
    const f = checkAcl("acl-bug.sol", load("acl-bug.sol"));
    const writes = f.filter((x) => x.rule === "acl-missing-allowThis");
    expect(writes.length).toBeGreaterThanOrEqual(2);
    expect(writes[0]?.severity).toBe("CRITICAL");
    expect(writes[0]?.category).toBe("ACL");
  });

  it("does not let commented-out FHE.allowThis suppress findings", () => {
    const src = `pragma solidity ^0.8.27;
contract X {
  euint64 public total;
  function f(euint64 v) external {
    total = v;
    // FHE.allowThis(total);
  }
}`;
    const f = checkAcl("x.sol", src);
    expect(f.some((x) => x.rule === "acl-missing-allowThis")).toBe(true);
  });

  it("flags encrypted return without FHE.allow(value, msg.sender) (positive)", () => {
    const f = checkAcl("acl-bug.sol", load("acl-bug.sol"));
    const retFinding = f.find((x) => x.rule === "acl-missing-allow-return");
    expect(retFinding).toBeTruthy();
    expect(retFinding?.severity).toBe("CRITICAL");
  });

  it("does not flag clean.sol (negative)", () => {
    const f = checkAcl("clean.sol", load("clean.sol"));
    expect(f).toEqual([]);
  });

  it("ignores .ts files", () => {
    expect(checkAcl("foo.ts", "balance[user] = amount;")).toEqual([]);
  });
});

// ---------------- Cleartext checker ----------------
describe("checkCleartext", () => {
  it("flags require() with leaky message (positive)", () => {
    const f = checkCleartext("cleartext-bug.sol", load("cleartext-bug.sol"));
    const reqLeak = f.find((x) => x.rule === "cleartext-require-message");
    expect(reqLeak).toBeTruthy();
  });

  it("flags emit with decrypted variable (positive)", () => {
    const f = checkCleartext("cleartext-bug.sol", load("cleartext-bug.sol"));
    const emitFinding = f.find((x) => x.rule === "cleartext-emit-decrypted");
    expect(emitFinding).toBeTruthy();
    expect(emitFinding?.severity).toBe("CRITICAL");
  });

  it("flags decrypt-then-emit pattern (positive)", () => {
    const src = `pragma solidity ^0.8.27;
contract X {
  event E(uint256 v);
  function f() external {
    uint256 leaked = FHE.decrypt(handle);
    emit E(leaked);
  }
}`;
    const f = checkCleartext("x.sol", src);
    expect(f.length).toBeGreaterThan(0);
    expect(f.some((x) => x.category === "CLEARTEXT")).toBe(true);
  });

  it("does not flag clean.sol (negative)", () => {
    const f = checkCleartext("clean.sol", load("clean.sol"));
    expect(f).toEqual([]);
  });
});

// ---------------- HCU counter ----------------
describe("checkHcu", () => {
  it("flags >20 ops as CRITICAL (positive)", () => {
    const f = checkHcu("hcu-explosion.sol", load("hcu-explosion.sol"));
    const big = f.find((x) => x.rule === "hcu-explosion-error");
    expect(big).toBeTruthy();
    expect(big?.severity).toBe("CRITICAL");
    expect(big?.message).toMatch(/bigPipeline/);
  });

  it("flags >12 ops as WARNING (positive)", () => {
    const f = checkHcu("hcu-explosion.sol", load("hcu-explosion.sol"));
    const med = f.find((x) => x.rule === "hcu-explosion-warning");
    expect(med).toBeTruthy();
    expect(med?.severity).toBe("WARNING");
    expect(med?.message).toMatch(/mediumPipeline/);
  });

  it("does not flag tiny function (negative)", () => {
    const f = checkHcu("hcu-explosion.sol", load("hcu-explosion.sol"));
    const tiny = f.find((x) => x.message.includes("`tiny`"));
    expect(tiny).toBeUndefined();
  });

  it("does not flag clean.sol (negative)", () => {
    const f = checkHcu("clean.sol", load("clean.sol"));
    expect(f).toEqual([]);
  });
});

// ---------------- Deprecation grep ----------------
describe("checkDeprecations", () => {
  it("flags deprecated fhevm import in .sol (positive)", () => {
    const f = checkDeprecations("deprecated.sol", load("deprecated.sol"));
    expect(f.length).toBe(1);
    expect(f[0]?.severity).toBe("CRITICAL");
    expect(f[0]?.rule).toBe("deprecated-import-fhevm");
  });

  it("flags deprecated fhevmjs import in .ts (positive)", () => {
    const f = checkDeprecations("deprecated.ts", load("deprecated.ts"));
    expect(f.length).toBe(1);
    expect(f[0]?.severity).toBe("CRITICAL");
    expect(f[0]?.rule).toBe("deprecated-import-fhevmjs");
  });

  it("does not flag @fhevm/solidity (negative)", () => {
    const src = `import {FHE} from "@fhevm/solidity/lib/FHE.sol";`;
    expect(checkDeprecations("foo.sol", src)).toEqual([]);
  });

  it("does not flag @zama-fhe/relayer-sdk (negative)", () => {
    const src = `import { createInstance } from "@zama-fhe/relayer-sdk";`;
    expect(checkDeprecations("foo.ts", src)).toEqual([]);
  });

  it("does not flag clean.sol (negative)", () => {
    const f = checkDeprecations("clean.sol", load("clean.sol"));
    expect(f).toEqual([]);
  });
});

// ---------------- Report renderer ----------------
describe("renderReport", () => {
  it("renders empty result with success message", () => {
    const md = renderReport({
      rootPath: "/tmp",
      scannedFiles: 0,
      findings: [],
      startedAt: "2026-05-04T00:00:00Z",
      finishedAt: "2026-05-04T00:00:01Z",
    });
    expect(md).toMatch(/# Zama Audit Report/);
    expect(md).toMatch(/No FHE-aware issues detected/);
  });

  it("renders findings with severity sections and totals", () => {
    const md = renderReport({
      rootPath: "/tmp",
      scannedFiles: 1,
      findings: [
        {
          file: "x.sol",
          line: 10,
          severity: "CRITICAL",
          category: "ACL",
          rule: "acl-missing-allowThis",
          message: "missing grant",
          suggestion: "add FHE.allowThis(...)",
          snippet: "balance[u] = amount;",
        },
        {
          file: "x.sol",
          line: 20,
          severity: "WARNING",
          category: "HCU",
          rule: "hcu-explosion-warning",
          message: "13 ops",
          suggestion: "split",
          snippet: "function foo (13 ops)",
        },
      ],
      startedAt: "2026-05-04T00:00:00Z",
      finishedAt: "2026-05-04T00:00:01Z",
    });
    expect(md).toMatch(/CRITICAL.*1/);
    expect(md).toMatch(/WARNING.*1/);
    expect(md).toMatch(/Per-file summary/);
    expect(md).toMatch(/acl-missing-allowThis/);
    expect(md).toMatch(/hcu-explosion-warning/);
  });
});

// ---------------- Orchestrator ----------------
describe("runAudit (end-to-end)", () => {
  it("aggregates findings across fixture files", () => {
    const files = [
      "acl-bug.sol",
      "cleartext-bug.sol",
      "hcu-explosion.sol",
      "deprecated.sol",
      "deprecated.ts",
      "clean.sol",
    ].map((n) => resolve(FIX_DIR, n));
    const summary = runAudit({ rootPath: FIX_DIR, files });
    expect(summary.scannedFiles).toBe(files.length);
    expect(summary.findings.length).toBeGreaterThan(5);
    const cats = new Set(summary.findings.map((f) => f.category));
    expect(cats.has("ACL")).toBe(true);
    expect(cats.has("CLEARTEXT")).toBe(true);
    expect(cats.has("HCU")).toBe(true);
    expect(cats.has("DEPRECATED")).toBe(true);
  });

  it("returns no findings on a single clean fixture", () => {
    const summary = runAudit({
      rootPath: FIX_DIR,
      files: [resolve(FIX_DIR, "clean.sol")],
    });
    expect(summary.findings).toEqual([]);
  });
});
