/**
 * generate.test.ts — vitest suite covering cleartext-guard, acl-injector,
 * preflight, and the end-to-end generate() flow.
 *
 * Plan 04-01, Tasks 2 + 3.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

import {
  assertNoCleartextLeak,
  CleartextLeakError,
  FORBIDDEN_PATTERNS,
} from "./lib/cleartext-guard.ts";
import { injectAclGrants } from "./lib/acl-injector.ts";
import { preflight } from "./lib/preflight.ts";
import { generateContract } from "./generate.ts";

// ---------------- cleartext-guard ----------------

describe("cleartext-guard", () => {
  it("exports at least 12 forbidden patterns", () => {
    expect(FORBIDDEN_PATTERNS.length).toBeGreaterThanOrEqual(12);
    for (const p of FORBIDDEN_PATTERNS) {
      expect(p.pattern).toBeInstanceOf(RegExp);
      expect(p.name).toBeTruthy();
      expect(p.replacement).toBeTruthy();
    }
  });

  it("throws on require(FHE.decrypt(x))", () => {
    expect(() =>
      assertNoCleartextLeak("require(FHE.decrypt(balance));"),
    ).toThrow(CleartextLeakError);
  });

  it("throws on require(decrypt(x))", () => {
    expect(() => assertNoCleartextLeak("require(decrypt(x));")).toThrow(
      CleartextLeakError,
    );
  });

  it("throws on if (decrypt(x))", () => {
    expect(() => assertNoCleartextLeak("if (decrypt(x)) { }")).toThrow(
      CleartextLeakError,
    );
  });

  it("throws on if (FHE.decrypt(x))", () => {
    expect(() => assertNoCleartextLeak("if (FHE.decrypt(x)) { }")).toThrow(
      CleartextLeakError,
    );
  });

  it("throws on euint64 typed comparison via ==", () => {
    const src = `
      euint64 a;
      euint64 b;
      function f() public { if (a == b) { } }
    `;
    expect(() => assertNoCleartextLeak(src)).toThrow(CleartextLeakError);
  });

  it("throws on euint64 typed comparison via <", () => {
    const src = `euint64 a; euint64 b; bool x = a < b;`;
    expect(() => assertNoCleartextLeak(src)).toThrow(CleartextLeakError);
  });

  it("passes on FHE.lt(a, b)", () => {
    const src = `euint64 a; euint64 b; ebool c = FHE.lt(a, b);`;
    expect(() => assertNoCleartextLeak(src)).not.toThrow();
  });

  it("passes on plain Solidity (no encrypted handles)", () => {
    const src = `uint256 a; uint256 b; if (a == b) {}`;
    expect(() => assertNoCleartextLeak(src)).not.toThrow();
  });

  it("error message mentions the matched pattern name", () => {
    try {
      assertNoCleartextLeak("require(FHE.decrypt(x));");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CleartextLeakError);
      expect((err as Error).message).toMatch(/require.*decrypt/i);
      expect((err as Error).message).toMatch(/FHE\.allow/);
    }
  });
});

// ---------------- acl-injector ----------------

describe("acl-injector", () => {
  it("appends FHE.allowThis after a euint storage assignment", () => {
    const src = `
contract C {
  euint64 balance;
  function add(externalEuint64 a) public {
    balance = FHE.add(balance, FHE.fromExternal(a));
  }
}
`;
    const out = injectAclGrants(src);
    expect(out.injected).toBeGreaterThan(0);
    expect(out.source).toMatch(/FHE\.allowThis\(balance\)/);
  });

  it("inserts FHE.allow(handle, msg.sender) before return for encrypted return type", () => {
    const src = `
contract C {
  euint64 balance;
  function get() public returns (euint64) {
    return balance;
  }
}
`;
    const out = injectAclGrants(src);
    expect(out.source).toMatch(/FHE\.allow\(balance,\s*msg\.sender\)/);
    // The grant must come before the return
    const allowIdx = out.source.indexOf("FHE.allow(balance");
    const returnIdx = out.source.indexOf("return balance");
    expect(allowIdx).toBeGreaterThan(0);
    expect(allowIdx).toBeLessThan(returnIdx);
  });

  it("is idempotent — running twice does not duplicate grants", () => {
    const src = `
contract C {
  euint64 balance;
  function add(externalEuint64 a) public {
    balance = FHE.add(balance, FHE.fromExternal(a));
  }
  function get() public returns (euint64) {
    return balance;
  }
}
`;
    const once = injectAclGrants(src).source;
    const twice = injectAclGrants(once).source;
    const countAllowThis = (s: string) =>
      (s.match(/FHE\.allowThis\(balance\)/g) ?? []).length;
    const countAllow = (s: string) =>
      (s.match(/FHE\.allow\(balance,\s*msg\.sender\)/g) ?? []).length;
    expect(countAllowThis(twice)).toBe(countAllowThis(once));
    expect(countAllow(twice)).toBe(countAllow(once));
  });

  it("does not inject for plain uint variables", () => {
    const src = `
contract C {
  uint256 x;
  function set() public { x = 5; }
}
`;
    const out = injectAclGrants(src);
    expect(out.injected).toBe(0);
    expect(out.source).not.toMatch(/FHE\.allowThis/);
  });
});

// ---------------- preflight ----------------

describe("preflight", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "zama-contract-preflight-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns error when packages/contracts/ is missing", () => {
    const r = preflight({ cwd: dir });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Run \/zama-init first/);
  });

  it("returns ok when packages/contracts/ exists and @fhevm/solidity is in deps", () => {
    mkdirSync(join(dir, "packages", "contracts", "contracts"), {
      recursive: true,
    });
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "x",
        dependencies: { "@fhevm/solidity": "^0.11.1" },
      }),
    );
    const r = preflight({ cwd: dir });
    expect(r.ok).toBe(true);
  });

  it("returns error when @fhevm/solidity is missing from package.json", () => {
    mkdirSync(join(dir, "packages", "contracts", "contracts"), {
      recursive: true,
    });
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "x", dependencies: {} }),
    );
    const r = preflight({ cwd: dir });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/@fhevm\/solidity/);
  });

  it("accepts @fhevm/solidity as a workspace devDependency", () => {
    mkdirSync(join(dir, "packages", "contracts", "contracts"), {
      recursive: true,
    });
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "root",
        devDependencies: { "@fhevm/solidity": "^0.11.1" },
      }),
    );
    const r = preflight({ cwd: dir });
    expect(r.ok).toBe(true);
  });
});

// ---------------- generateContract (Task 3) ----------------

describe("generateContract", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "zama-contract-generate-"));
    mkdirSync(join(dir, "packages", "contracts", "contracts"), {
      recursive: true,
    });
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "x",
        dependencies: { "@fhevm/solidity": "^0.11.1" },
      }),
    );
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("standalone: writes Counter.sol with HCU header, FHE imports, ACL grants", () => {
    const result = generateContract({
      cwd: dir,
      inputs: {
        name: "Counter",
        base: "standalone",
        schema: [{ name: "counter", type: "euint64" }],
        decryptionPath: "user",
      },
    });
    const file = join(dir, "packages", "contracts", "contracts", "Counter.sol");
    expect(existsSync(file)).toBe(true);
    const src = readFileSync(file, "utf8");
    expect(src).toMatch(/HCU budget: 20M\/tx, 5M depth/);
    expect(src).toMatch(/from "@fhevm\/solidity\/lib\/FHE\.sol"/);
    expect(src).toMatch(/euint64\s+counter/);
    expect(src).toMatch(/FHE\.allowThis\(counter\)/);
    expect(src).toMatch(/FHE\.allow\(counter,\s*msg\.sender\)/);
    // No deprecated imports
    expect(src).not.toMatch(/fhevmjs/);
    expect(src).not.toMatch(/import\s+["']fhevm["']/);
    expect(result.path).toBe(file);
    expect(result.aclGrantsInjected).toBeGreaterThan(0);
  });

  it("erc7984: imports the OZ ERC7984 base", () => {
    generateContract({
      cwd: dir,
      inputs: {
        name: "MyToken",
        base: "erc7984",
        schema: [],
        decryptionPath: "user",
      },
    });
    const src = readFileSync(
      join(dir, "packages", "contracts", "contracts", "MyToken.sol"),
      "utf8",
    );
    expect(src).toMatch(
      /from "@openzeppelin\/confidential-contracts\/token\/ERC7984\/ERC7984\.sol"/,
    );
    expect(src).toMatch(/is ERC7984/);
  });

  it("votes: imports VotesConfidential", () => {
    generateContract({
      cwd: dir,
      inputs: {
        name: "MyVotes",
        base: "votes",
        schema: [],
        decryptionPath: "user",
      },
    });
    const src = readFileSync(
      join(dir, "packages", "contracts", "contracts", "MyVotes.sol"),
      "utf8",
    );
    expect(src).toMatch(
      /from "@openzeppelin\/confidential-contracts\/governance\/VotesConfidential\.sol"/,
    );
  });

  it("refuses to overwrite existing file without force", () => {
    generateContract({
      cwd: dir,
      inputs: {
        name: "Counter",
        base: "standalone",
        schema: [{ name: "counter", type: "euint64" }],
        decryptionPath: "user",
      },
    });
    expect(() =>
      generateContract({
        cwd: dir,
        inputs: {
          name: "Counter",
          base: "standalone",
          schema: [{ name: "counter", type: "euint64" }],
          decryptionPath: "user",
        },
      }),
    ).toThrow(/exists/);
  });

  it("overwrites with force=true", () => {
    generateContract({
      cwd: dir,
      inputs: {
        name: "Counter",
        base: "standalone",
        schema: [{ name: "counter", type: "euint64" }],
        decryptionPath: "user",
      },
    });
    expect(() =>
      generateContract({
        cwd: dir,
        force: true,
        inputs: {
          name: "Counter",
          base: "standalone",
          schema: [{ name: "counter", type: "euint64" }],
          decryptionPath: "user",
        },
      }),
    ).not.toThrow();
  });

  it("refuses path-traversal contract names", () => {
    expect(() =>
      generateContract({
        cwd: dir,
        inputs: {
          name: "../evil",
          base: "standalone",
          schema: [],
          decryptionPath: "user",
        },
      }),
    ).toThrow(/PascalCase/);
  });

  it("public decryption path emits FHE.makePubliclyDecryptable", () => {
    generateContract({
      cwd: dir,
      inputs: {
        name: "Tally",
        base: "standalone",
        schema: [{ name: "result", type: "euint64" }],
        decryptionPath: "public",
      },
    });
    const src = readFileSync(
      join(dir, "packages", "contracts", "contracts", "Tally.sol"),
      "utf8",
    );
    expect(src).toMatch(/FHE\.makePubliclyDecryptable\(result\)/);
  });

  it("oracle decryption path emits FHE.requestDecryption + callback", () => {
    generateContract({
      cwd: dir,
      inputs: {
        name: "Settler",
        base: "standalone",
        schema: [{ name: "outcome", type: "euint64" }],
        decryptionPath: "oracle",
      },
    });
    const src = readFileSync(
      join(dir, "packages", "contracts", "contracts", "Settler.sol"),
      "utf8",
    );
    expect(src).toMatch(/FHE\.requestDecryption/);
  });
});
