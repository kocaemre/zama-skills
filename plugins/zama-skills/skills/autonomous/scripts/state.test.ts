import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  PIPELINE_ORDER,
  newState,
  advance,
  saveState,
  loadState,
  clearState,
  type AutonomousState,
  type PipelineStep,
} from "./state.js";

let TMP: string;
let STATE_PATH: string;

beforeEach(() => {
  TMP = mkdtempSync(join(tmpdir(), "zama-autonomous-state-"));
  STATE_PATH = join(TMP, "state.json");
});

describe("PIPELINE_ORDER", () => {
  it("starts at doctor and ends at done", () => {
    expect(PIPELINE_ORDER[0]).toBe("doctor");
    expect(PIPELINE_ORDER[PIPELINE_ORDER.length - 1]).toBe("done");
  });

  it("includes every safety-critical step in order", () => {
    expect(PIPELINE_ORDER).toEqual([
      "doctor",
      "design",
      "init",
      "contract",
      "test",
      "audit",
      "deploy",
      "frontend",
      "done",
    ]);
  });
});

describe("newState", () => {
  it("starts at doctor with empty completedSteps", () => {
    const s = newState();
    expect(s.currentStep).toBe("doctor");
    expect(s.completedSteps).toEqual([]);
    expect(s.useCase).toBeNull();
    expect(s.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(s.updatedAt).toBe(s.startedAt);
  });

  it("accepts a useCase slug", () => {
    const s = newState("private-voting");
    expect(s.useCase).toBe("private-voting");
  });
});

describe("advance", () => {
  it("moves to the next step in PIPELINE_ORDER", () => {
    const s = newState();
    const after = advance(s, "doctor");
    expect(after.currentStep).toBe("design");
    expect(after.completedSteps).toEqual(["doctor"]);
  });

  it("does not duplicate completed steps", () => {
    let s = newState();
    s = advance(s, "doctor");
    s = advance(s, "doctor"); // re-completing should not duplicate
    expect(s.completedSteps).toEqual(["doctor"]);
    expect(s.currentStep).toBe("design");
  });

  it("rolls into 'done' after frontend", () => {
    const s: AutonomousState = {
      useCase: "x",
      completedSteps: PIPELINE_ORDER.slice(0, 7) as PipelineStep[],
      currentStep: "frontend",
      startedAt: "2026-05-04T00:00:00Z",
      updatedAt: "2026-05-04T00:00:00Z",
    };
    const after = advance(s, "frontend");
    expect(after.currentStep).toBe("done");
  });

  it("throws on unknown step", () => {
    expect(() => advance(newState(), "bogus" as PipelineStep)).toThrow(/unknown/);
  });
});

describe("saveState / loadState / clearState round-trip", () => {
  it("writes JSON, loads it back, and clear removes the file", () => {
    const s = advance(newState("voting"), "doctor");
    saveState(s, STATE_PATH);

    expect(existsSync(STATE_PATH)).toBe(true);
    const loaded = loadState(STATE_PATH);
    expect(loaded).not.toBeNull();
    expect(loaded!.useCase).toBe("voting");
    expect(loaded!.currentStep).toBe("design");
    expect(loaded!.completedSteps).toEqual(["doctor"]);

    clearState(STATE_PATH);
    expect(existsSync(STATE_PATH)).toBe(false);
  });

  it("loadState returns null when file missing", () => {
    expect(loadState(STATE_PATH)).toBeNull();
  });

  it("loadState returns null when file is corrupt", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    fs.mkdirSync(TMP, { recursive: true });
    fs.writeFileSync(STATE_PATH, "{not json}");
    expect(loadState(STATE_PATH)).toBeNull();
  });

  it("saveState updates updatedAt timestamp", async () => {
    const s = newState("x");
    saveState(s, STATE_PATH);
    const first = JSON.parse(readFileSync(STATE_PATH, "utf8")) as AutonomousState;

    await new Promise((r) => setTimeout(r, 10));
    saveState(s, STATE_PATH);
    const second = JSON.parse(readFileSync(STATE_PATH, "utf8")) as AutonomousState;

    expect(second.updatedAt > first.updatedAt).toBe(true);
  });
});
