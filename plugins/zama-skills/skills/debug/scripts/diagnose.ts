#!/usr/bin/env -S npx tsx
/**
 * diagnose.ts — entry point for /zama-debug.
 *
 * Reads error text from one of:
 *   1. argv: `tsx diagnose.ts --error "<text>"`
 *   2. argv: `tsx diagnose.ts --file path/to/error.txt`
 *   3. stdin: `cat error.log | tsx diagnose.ts`
 *
 * Matches against the pattern database in `lib/patterns.ts` and prints a
 * markdown diagnosis (cause + fix steps + reference link). Exits 0 on a
 * matched diagnosis, 1 on no-match, 2 on usage error.
 *
 * The skill instructs Claude to gather the error text via AskUserQuestion
 * before invoking this script — so the typical call is `--error "..."`.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { diagnose, renderDiagnosis } from "./lib/matcher.ts";
import { PATTERN_COUNT } from "./lib/patterns.ts";

interface CliArgs {
  errorText?: string;
  file?: string;
  help?: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const out: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--error" || a === "-e") {
      out.errorText = argv[++i];
    } else if (a === "--file" || a === "-f") {
      out.file = argv[++i];
    } else if (a === "--help" || a === "-h") {
      out.help = true;
    }
  }
  return out;
}

function readStdinSync(): string {
  try {
    // Node returns "" if stdin is a TTY (not piped). That's fine — we
    // treat empty input as a usage error downstream.
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function printHelp(): void {
  console.log(
    [
      "/zama-debug — diagnose fhEVM errors against a known-pattern catalog.",
      "",
      `Patterns registered: ${PATTERN_COUNT}`,
      "",
      "Usage:",
      "  tsx diagnose.ts --error \"<paste error text>\"",
      "  tsx diagnose.ts --file path/to/error.log",
      "  cat error.log | tsx diagnose.ts",
      "",
      "Exit codes:",
      "  0  matched (diagnosis printed)",
      "  1  no match (suggested next steps printed)",
      "  2  usage error",
    ].join("\n"),
  );
}

export interface RunOptions {
  argv: readonly string[];
  stdin: string;
}

export interface RunResult {
  exitCode: number;
  output: string;
}

/**
 * Pure run() so tests can drive the CLI without touching real argv/stdin.
 */
export function run(opts: RunOptions): RunResult {
  const args = parseArgs(opts.argv);
  if (args.help) {
    return { exitCode: 2, output: "" };
  }

  let errorText = args.errorText;
  if (!errorText && args.file) {
    try {
      errorText = readFileSync(resolve(args.file), "utf8");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        exitCode: 2,
        output: `Failed to read --file ${args.file}: ${msg}\n`,
      };
    }
  }
  if (!errorText) {
    errorText = opts.stdin;
  }
  if (!errorText || errorText.trim().length === 0) {
    return {
      exitCode: 2,
      output:
        "No error text supplied. Pass --error \"...\", --file path, or pipe via stdin.\n",
    };
  }

  const result = diagnose(errorText);
  const md = renderDiagnosis(result);
  return { exitCode: result.matched ? 0 : 1, output: md };
}

// CLI entry — only run when invoked directly, not when imported by tests.
const invokedDirectly =
  typeof process !== "undefined" &&
  process.argv[1] &&
  /diagnose\.ts$/.test(process.argv[1]);

if (invokedDirectly) {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  const stdin = process.stdin.isTTY ? "" : readStdinSync();
  const { exitCode, output } = run({ argv, stdin });
  process.stdout.write(output);
  process.exit(exitCode);
}
