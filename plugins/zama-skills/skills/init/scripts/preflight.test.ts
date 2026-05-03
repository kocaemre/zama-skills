/**
 * preflight.test.ts — branch coverage for `runPreflight`.
 *
 * Plan 03-06. Uses the dependency-injection shape already exposed by
 * `preflight.ts` (PreflightOptions: nodeVersion, pnpmCmd, skipNetwork,
 * timeoutMs). Network failure is exercised by pointing the probe at an
 * unreachable host via a 1ms timeout — no module mocks needed.
 */

import { describe, it, expect } from "vitest";
import { runPreflight } from "./preflight.js";

const REAL_PNPM = "pnpm";
// A command that almost certainly does not exist on PATH.
const FAKE_PNPM = "definitely-not-a-real-binary-zama-test-xxx";

describe("runPreflight", () => {
  it("returns ok=true when Node 20 + pnpm + skipNetwork are all good", async () => {
    const result = await runPreflight({
      nodeVersion: "20.10.0",
      pnpmCmd: REAL_PNPM,
      skipNetwork: true,
    });
    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.details["node"]).toBe("20.10.0");
    expect(result.details["internet"]).toBe("skipped");
  });

  it("flags Node < 20 as a failure", async () => {
    const result = await runPreflight({
      nodeVersion: "18.19.0",
      pnpmCmd: REAL_PNPM,
      skipNetwork: true,
    });
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => /Node 20\+/.test(f))).toBe(true);
  });

  it("accepts Node 22 as valid", async () => {
    const result = await runPreflight({
      nodeVersion: "22.5.1",
      pnpmCmd: REAL_PNPM,
      skipNetwork: true,
    });
    expect(result.ok).toBe(true);
  });

  it("flags missing pnpm when binary not found on PATH", async () => {
    const result = await runPreflight({
      nodeVersion: "22.0.0",
      pnpmCmd: FAKE_PNPM,
      skipNetwork: true,
    });
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => /pnpm not found/.test(f))).toBe(true);
  });

  it("does not invoke network probe when skipNetwork=true", async () => {
    // If skipNetwork were ignored we'd hit a real registry — assert the
    // detail field instead, which is the contract.
    const result = await runPreflight({
      nodeVersion: "20.10.0",
      pnpmCmd: REAL_PNPM,
      skipNetwork: true,
    });
    expect(result.details["internet"]).toBe("skipped");
  });

  it("flags network failure when timeout is impossibly small", async () => {
    // 1ms timeout — even a local hit can't open a TLS socket that fast.
    // This avoids needing to mock the https module while still exercising
    // the timeout branch deterministically.
    const result = await runPreflight({
      nodeVersion: "20.10.0",
      pnpmCmd: REAL_PNPM,
      skipNetwork: false,
      timeoutMs: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => /registry/i.test(f))).toBe(true);
  }, 15_000);

  it("aggregates multiple failures (Node + pnpm) in one run", async () => {
    const result = await runPreflight({
      nodeVersion: "16.0.0",
      pnpmCmd: FAKE_PNPM,
      skipNetwork: true,
    });
    expect(result.ok).toBe(false);
    expect(result.failures.length).toBeGreaterThanOrEqual(2);
  });
});
