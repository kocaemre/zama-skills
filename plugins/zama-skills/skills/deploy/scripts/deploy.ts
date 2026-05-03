/**
 * deploy.ts — STUB. Real implementation lands in Task 3.
 *
 * Exporting the surface so vitest can resolve imports for the
 * env-validate / sepolia-addresses / abi-export / preflight tests
 * in isolation.
 */

export interface RunDeployOptions {
  contract: string;
  args?: string[];
  env?: Record<string, string | undefined>;
  cwd?: string;
  exec?: (cmd: string, opts?: { cwd?: string }) => string;
  fetcher?: () => Promise<string>;
}

export interface RunDeployResult {
  ok: boolean;
  address?: string;
  txHash?: string;
  registryTxHash?: string;
  abiPath?: string;
  summary?: string;
  missingEnv?: string[];
  preflightFailures?: string[];
  error?: string;
}

export async function runDeploy(
  _opts: RunDeployOptions,
): Promise<RunDeployResult> {
  return {
    ok: false,
    error: "runDeploy not yet implemented (Task 3)",
  };
}
