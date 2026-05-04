/**
 * generate.ts — orchestrator for /zama-contract code generation.
 *
 * Pipeline:
 *   1. Validate inputs (PascalCase name, supported base, etc.)
 *   2. Load template by `base` from assets/templates/
 *   3. Substitute placeholders ({{NAME}}, {{STATE_DECLS}}, {{SETTERS}}, {{GETTERS}})
 *   4. Run `injectAclGrants` (ensures FHE.allowThis after every encrypted write
 *      and FHE.allow before every encrypted return)
 *   5. Run `assertNoCleartextLeak` (refuses 12 forbidden patterns)
 *   6. Final post-grep for deprecated `fhevmjs` / root `fhevm` imports — fail
 *      if found.
 *   7. Write to packages/contracts/contracts/<Name>.sol (refuse overwrite
 *      without --force).
 *
 * Plan 04-01, Task 3.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, exit, stderr, stdout } from "node:process";

import { injectAclGrants } from "./lib/acl-injector.ts";
import {
  assertNoCleartextLeak,
  CleartextLeakError,
  FORBIDDEN_PATTERNS,
} from "./lib/cleartext-guard.ts";

export type EncryptedType =
  | "euint8"
  | "euint16"
  | "euint32"
  | "euint64"
  | "ebool"
  | "eaddress";

export type BaseContract = "standalone" | "erc7984" | "wrapper" | "votes" | "ownable";
export type DecryptionPath = "public" | "user" | "oracle";

export interface SchemaField {
  name: string;
  type: EncryptedType;
  mapping?: "address" | "uint256" | null;
}

export interface ContractInputs {
  name: string;
  base: BaseContract;
  schema: SchemaField[];
  decryptionPath: DecryptionPath;
}

export interface GenerateOptions {
  cwd?: string;
  inputs: ContractInputs;
  force?: boolean;
}

export interface GenerateResult {
  path: string;
  aclGrantsInjected: number;
  cleartextPatternsChecked: number;
}

const NAME_RE = /^[A-Z][A-Za-z0-9]+$/;

function locateTemplatesRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "assets", "templates");
}

function templateFor(base: BaseContract): string {
  const root = locateTemplatesRoot();
  switch (base) {
    case "erc7984":
      return resolve(root, "erc7984.sol.tpl");
    case "wrapper":
      return resolve(root, "wrapper.sol.tpl");
    case "votes":
      return resolve(root, "votes.sol.tpl");
    case "ownable":
    case "standalone":
    default:
      return resolve(root, "contract.sol.tpl");
  }
}

function renderStateDecls(schema: SchemaField[]): string {
  if (schema.length === 0) return "    // No state schema.";
  const lines: string[] = [];
  for (const f of schema) {
    if (f.mapping === "address") {
      lines.push(`    mapping(address => ${f.type}) internal ${f.name};`);
    } else if (f.mapping === "uint256") {
      lines.push(`    mapping(uint256 => ${f.type}) internal ${f.name};`);
    } else {
      lines.push(`    ${f.type} ${f.name};`);
    }
  }
  return lines.join("\n");
}

function externalTypeFor(t: EncryptedType): string {
  switch (t) {
    case "ebool":
      return "externalEbool";
    case "eaddress":
      // eaddress has no externalEaddress in 0.11.x; use externalEuint as the
      // closest analog. We default to externalEuint64 here for the demo
      // setter — users will adapt.
      return "externalEuint64";
    default:
      return `external${capitalize(t)}`;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function renderSetter(f: SchemaField): string {
  const ext = externalTypeFor(f.type);
  const slot = f.mapping ? `${f.name}[key]` : f.name;
  const keyParam =
    f.mapping === "address"
      ? "address key, "
      : f.mapping === "uint256"
        ? "uint256 key, "
        : "";
  return `    function set_${f.name}(${keyParam}${ext} encryptedValue, bytes calldata inputProof) external {
        ${f.type} value = FHE.fromExternal(encryptedValue, inputProof);
        ${slot} = value;
    }`;
}

function renderGetter(f: SchemaField, path: DecryptionPath): string {
  const slot = f.mapping ? `${f.name}[key]` : f.name;
  const keyParam =
    f.mapping === "address"
      ? "address key"
      : f.mapping === "uint256"
        ? "uint256 key"
        : "";

  if (path === "public") {
    return `    function publish_${f.name}(${keyParam}) external {
        FHE.makePubliclyDecryptable(${slot});
    }`;
  }
  if (path === "oracle") {
    return `    function request_${f.name}(${keyParam}) external {
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(${slot});
        FHE.requestDecryption(cts, this.callback_${f.name}.selector);
    }

    function callback_${f.name}(uint256 /*requestID*/, ${
      f.type === "ebool" ? "bool" : "uint64"
    } cleartext, bytes[] memory /*signatures*/) public {
        // off-chain relayer posts plaintext here; downstream logic can act on it
        emit Decrypted_${f.name}(cleartext);
    }

    event Decrypted_${f.name}(${
      f.type === "ebool" ? "bool" : "uint64"
    } value);`;
  }
  // user path (default)
  const returnType = f.type;
  return `    function get_${f.name}(${keyParam}) external returns (${returnType}) {
        return ${slot};
    }`;
}

function renderSetters(schema: SchemaField[]): string {
  if (schema.length === 0) return "    // No setters generated.";
  return schema.map(renderSetter).join("\n\n");
}

function renderGetters(schema: SchemaField[], path: DecryptionPath): string {
  if (schema.length === 0) return "    // No getters generated.";
  return schema.map((f) => renderGetter(f, path)).join("\n\n");
}

function validateInputs(inputs: ContractInputs): void {
  if (!NAME_RE.test(inputs.name)) {
    throw new Error(
      `Contract name "${inputs.name}" must be PascalCase matching ${NAME_RE}. Refusing path-traversal or non-identifier names.`,
    );
  }
  const validBases: BaseContract[] = ["standalone", "erc7984", "wrapper", "votes", "ownable"];
  if (!validBases.includes(inputs.base)) {
    throw new Error(`Unknown base contract: ${inputs.base}`);
  }
  const validPaths: DecryptionPath[] = ["public", "user", "oracle"];
  if (!validPaths.includes(inputs.decryptionPath)) {
    throw new Error(`Unknown decryption path: ${inputs.decryptionPath}`);
  }
  for (const f of inputs.schema) {
    if (!/^[a-z][A-Za-z0-9]*$/.test(f.name)) {
      throw new Error(
        `Schema field "${f.name}" must match /^[a-z][A-Za-z0-9]*$/`,
      );
    }
  }
}

function checkDeprecatedImports(source: string): void {
  // Match `from "fhevmjs..."` or `import "fhevmjs..."`
  if (/\bfhevmjs\b/.test(source)) {
    throw new Error(
      "Generated contract references deprecated package `fhevmjs`. Use `@zama-fhe/relayer-sdk` instead.",
    );
  }
  // Match `from "fhevm"` or `import "fhevm"` (root pkg, exact match)
  if (/from\s+["']fhevm["']/.test(source) || /import\s+["']fhevm["']/.test(source)) {
    throw new Error(
      "Generated contract references deprecated root package `fhevm`. Use `@fhevm/solidity` instead.",
    );
  }
}

export function generateContract(opts: GenerateOptions): GenerateResult {
  const cwd = resolve(opts.cwd ?? process.cwd());
  validateInputs(opts.inputs);

  const tplPath = templateFor(opts.inputs.base);
  if (!existsSync(tplPath)) {
    throw new Error(`Template missing: ${tplPath}`);
  }
  let src = readFileSync(tplPath, "utf8");

  // Substitutions
  const ownableImport =
    opts.inputs.base === "ownable"
      ? `import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";`
      : "";
  const ownableInherits = opts.inputs.base === "ownable" ? ", Ownable" : "";

  src = src
    .split("{{NAME}}")
    .join(opts.inputs.name)
    .split("{{DECRYPTION_PATH}}")
    .join(opts.inputs.decryptionPath)
    .split("{{OWNABLE_IMPORT}}")
    .join(ownableImport)
    .split("{{OWNABLE_INHERITS}}")
    .join(ownableInherits)
    .split("{{STATE_DECLS}}")
    .join(renderStateDecls(opts.inputs.schema))
    .split("{{SETTERS}}")
    .join(renderSetters(opts.inputs.schema))
    .split("{{GETTERS}}")
    .join(renderGetters(opts.inputs.schema, opts.inputs.decryptionPath));

  // Inject ACL grants (idempotent post-pass)
  const acl = injectAclGrants(src);
  src = acl.source;

  // Cleartext-leak guard
  try {
    assertNoCleartextLeak(src);
  } catch (err) {
    if (err instanceof CleartextLeakError) {
      throw new Error(
        `Cleartext-leak guard refused generated contract: ${err.message}`,
      );
    }
    throw err;
  }

  // Deprecated import guard
  checkDeprecatedImports(src);

  // Write
  const outPath = resolve(
    cwd,
    "packages",
    "contracts",
    "contracts",
    `${opts.inputs.name}.sol`,
  );
  if (existsSync(outPath) && !opts.force) {
    throw new Error(
      `File exists: ${outPath} — pass force=true (or --force on CLI) to overwrite.`,
    );
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, src, "utf8");

  return {
    path: outPath,
    aclGrantsInjected: acl.injected,
    cleartextPatternsChecked: FORBIDDEN_PATTERNS.length,
  };
}

// ---------------- CLI ----------------

function parseArgs(args: string[]): { inputs: ContractInputs; force: boolean } {
  let inputsJson: string | undefined;
  let force = false;
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--inputs") {
      inputsJson = args[i + 1];
      i += 1;
    } else if (a === "--force") {
      force = true;
    }
  }
  if (!inputsJson) {
    throw new Error(
      "generate.ts: --inputs <json> required. Pass a JSON ContractInputs object.",
    );
  }
  return { inputs: JSON.parse(inputsJson) as ContractInputs, force };
}

const isDirectInvocation =
  argv[1] !== undefined &&
  resolve(argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectInvocation) {
  try {
    const { inputs, force } = parseArgs(argv.slice(2));
    const r = generateContract({ inputs, force });
    stdout.write(
      `Wrote: ${r.path}\nACL grants injected: ${r.aclGrantsInjected}\nCleartext patterns checked: ${r.cleartextPatternsChecked}\nThis contract refuses ${r.cleartextPatternsChecked} known cleartext-leak patterns.\nNext: run /zama-test to generate mock + Sepolia tests for this contract.\n`,
    );
    exit(0);
  } catch (err) {
    stderr.write(
      `${err instanceof Error ? err.message : String(err)}\n`,
    );
    exit(1);
  }
}
