#!/usr/bin/env tsx
/**
 * audit.ts — orchestrator for the `/zama-audit` skill.
 *
 * Walks a directory, runs the four FHE-aware checks (ACL, cleartext,
 * HCU, deprecated imports), and writes `AUDIT-REPORT.md` at the audit
 * root.
 *
 * CLI:
 *   tsx audit.ts [path]            # path defaults to cwd
 *   tsx audit.ts --out report.md   # override output path
 *
 * Exit code:
 *   0  no findings
 *   1  WARNING or higher
 *   2  CRITICAL findings
 *
 * Plan v1.1-skills audit, Task 7.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve, relative, sep } from "node:path";

import { checkAcl } from "./lib/acl-checker.ts";
import { checkCleartext } from "./lib/cleartext-checker.ts";
import { checkHcu } from "./lib/hcu-counter.ts";
import { checkDeprecations } from "./lib/deprecation-grep.ts";
import {
  renderReport,
  type AuditSummary,
  type Finding,
} from "./lib/report.ts";

const CODE_EXT_RE = /\.(sol|ts|tsx|js|jsx|mjs|cjs)$/;
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  "artifacts",
  "cache",
  "coverage",
  ".next",
  ".turbo",
  "__fixtures__", // never audit our own fixtures
  "typechain-types",
]);

function walk(root: string): string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop() as string;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (SKIP_DIRS.has(name)) continue;
      const full = join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        stack.push(full);
      } else if (st.isFile() && CODE_EXT_RE.test(name)) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

export interface AuditOptions {
  rootPath: string;
  files?: string[]; // override walking, for tests
}

export function runAudit(opts: AuditOptions): AuditSummary {
  const root = resolve(opts.rootPath);
  const startedAt = new Date().toISOString();
  const filesAbs =
    opts.files !== undefined ? opts.files : walk(root);
  const findings: Finding[] = [];

  for (const abs of filesAbs) {
    let source: string;
    try {
      source = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    const rel = relative(root, abs).split(sep).join("/") || abs;
    findings.push(...checkAcl(rel, source));
    findings.push(...checkCleartext(rel, source));
    findings.push(...checkHcu(rel, source));
    findings.push(...checkDeprecations(rel, source));
  }

  return {
    rootPath: root,
    scannedFiles: filesAbs.length,
    findings,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}

function parseArgs(argv: string[]): { path: string; out: string } {
  let path = ".";
  let out = "AUDIT-REPORT.md";
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] as string;
    if (a === "--out" && i + 1 < argv.length) {
      out = argv[i + 1] as string;
      i += 1;
    } else if (a === "--help" || a === "-h") {
      // eslint-disable-next-line no-console
      console.log(
        "Usage: tsx audit.ts [path] [--out report.md]\n" +
          "  path: directory to audit (default: cwd)\n" +
          "  --out: report output path (default: AUDIT-REPORT.md in audit root)",
      );
      process.exit(0);
    } else if (!a.startsWith("--")) {
      path = a;
    }
  }
  return { path, out };
}

function main(): void {
  const { path, out } = parseArgs(process.argv.slice(2));
  const targetPath = (() => {
    const candidate = resolve(path);
    if (existsSync(candidate) && statSync(candidate).isDirectory()) {
      return candidate;
    }
    // fall back: try packages/contracts/contracts under cwd
    const fallback = resolve(process.cwd(), "packages/contracts/contracts");
    if (existsSync(fallback)) return fallback;
    return candidate;
  })();

  const summary = runAudit({ rootPath: targetPath });
  const md = renderReport(summary);
  const outPath = resolve(targetPath, out);
  writeFileSync(outPath, md, "utf8");

  // eslint-disable-next-line no-console
  console.log(
    `audit: scanned ${summary.scannedFiles} files, ${summary.findings.length} findings — wrote ${outPath}`,
  );

  const hasCritical = summary.findings.some((f) => f.severity === "CRITICAL");
  const hasWarning = summary.findings.some((f) => f.severity === "WARNING");
  if (hasCritical) process.exit(2);
  if (hasWarning) process.exit(1);
  process.exit(0);
}

// Run as CLI when invoked directly
const isDirectInvocation =
  import.meta.url === `file://${process.argv[1]}` ||
  (process.argv[1] !== undefined && process.argv[1].endsWith("audit.ts"));
if (isDirectInvocation) {
  main();
}
