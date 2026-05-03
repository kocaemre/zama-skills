/**
 * generate.ts — orchestrator for /zama-contract code generation.
 *
 * Implementation in Task 3 (Plan 04-01). Task 2 only requires the module to
 * resolve so the colocated vitest suite can import library helpers.
 */

export type EncryptedType =
  | "euint8"
  | "euint16"
  | "euint32"
  | "euint64"
  | "ebool"
  | "eaddress";

export type BaseContract = "standalone" | "erc7984" | "votes" | "ownable";
export type DecryptionPath = "public" | "user" | "oracle";

export interface ContractInputs {
  name: string;
  base: BaseContract;
  schema: Array<{
    name: string;
    type: EncryptedType;
    mapping?: "address" | "uint256" | null;
  }>;
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

export function generateContract(_opts: GenerateOptions): GenerateResult {
  throw new Error(
    "generateContract: not implemented yet (filled in by Task 3 of plan 04-01).",
  );
}
