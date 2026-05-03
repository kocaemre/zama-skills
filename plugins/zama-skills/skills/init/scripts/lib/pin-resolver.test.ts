/**
 * pin-resolver.test.ts — pure-function tests for `resolvePins`.
 *
 * Plan 03-06 — covers happy path, solc special-case, alias keys, unknown keys,
 * multi-pin substitution, and no-op (template with no @pin markers).
 */

import { describe, it, expect } from "vitest";
import { resolvePins, type PinResolverDeps } from "./pin-resolver.js";

function makeDeps(overrides?: Partial<PinResolverDeps>): PinResolverDeps {
  const versions: Record<string, string> = {
    hardhat: "^2.28.4",
    ethers: "^6.16.0",
    "@fhevm/solidity": "^0.11.1",
    "@zama-fhe/relayer-sdk-dev": "0.4.1",
  };
  return {
    getVersion: (pkg: string) => {
      if (!(pkg in versions)) {
        throw new Error(`Package not found: ${pkg}`);
      }
      return versions[pkg]!;
    },
    getCompilerVersion: () => "0.8.27",
    ...overrides,
  };
}

describe("resolvePins", () => {
  it("replaces a single @pin with the resolved version", () => {
    const result = resolvePins("foo <!-- @pin:hardhat --> bar", makeDeps());
    expect(result.resolved).toBe("foo ^2.28.4 bar");
    expect(result.pins).toEqual({ hardhat: "^2.28.4" });
  });

  it("uses getCompilerVersion (not getVersion) for @pin:solc", () => {
    let getVersionCalls = 0;
    let getCompilerCalls = 0;
    const deps: PinResolverDeps = {
      getVersion: (p) => {
        getVersionCalls += 1;
        throw new Error(`should not be called for ${p}`);
      },
      getCompilerVersion: () => {
        getCompilerCalls += 1;
        return "0.8.27";
      },
    };
    const result = resolvePins("solc=<!-- @pin:solc -->", deps);
    expect(result.resolved).toBe("solc=0.8.27");
    expect(result.pins).toEqual({ solc: "0.8.27" });
    expect(getVersionCalls).toBe(0);
    expect(getCompilerCalls).toBe(1);
  });

  it("throws on unknown pin key with the key name in the error message", () => {
    const deps = makeDeps();
    expect(() =>
      resolvePins("oops <!-- @pin:totally-bogus-pkg --> end", deps),
    ).toThrow(/totally-bogus-pkg/);
  });

  it("supports alias keys (e.g. @zama-fhe/relayer-sdk-dev)", () => {
    const result = resolvePins(
      '"@zama-fhe/relayer-sdk": "<!-- @pin:@zama-fhe/relayer-sdk-dev -->"',
      makeDeps(),
    );
    expect(result.resolved).toContain('"0.4.1"');
    expect(result.pins["@zama-fhe/relayer-sdk-dev"]).toBe("0.4.1");
  });

  it("replaces multiple pins in one string and records all in pins record", () => {
    const result = resolvePins(
      "h=<!-- @pin:hardhat --> e=<!-- @pin:ethers --> s=<!-- @pin:solc -->",
      makeDeps(),
    );
    expect(result.resolved).toBe("h=^2.28.4 e=^6.16.0 s=0.8.27");
    expect(result.pins).toEqual({
      hardhat: "^2.28.4",
      ethers: "^6.16.0",
      solc: "0.8.27",
    });
  });

  it("returns text unchanged with empty pins record when no markers present", () => {
    const text = 'just a plain string with no markers, even { "deps": "x" }';
    const result = resolvePins(text, makeDeps());
    expect(result.resolved).toBe(text);
    expect(result.pins).toEqual({});
  });

  it("throws when getVersion returns empty string (defensive)", () => {
    const deps: PinResolverDeps = {
      getVersion: () => "",
      getCompilerVersion: () => "0.8.27",
    };
    expect(() => resolvePins("x=<!-- @pin:hardhat -->", deps)).toThrow(
      /hardhat/,
    );
  });
});
