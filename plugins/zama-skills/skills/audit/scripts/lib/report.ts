/**
 * report.ts — render audit findings as a Markdown report.
 *
 * Used by `audit.ts` to produce `AUDIT-REPORT.md` at the audit root.
 *
 * Plan v1.1-skills audit, Task 6.
 */

export type Severity = "CRITICAL" | "WARNING" | "INFO";
export type Category = "ACL" | "CLEARTEXT" | "HCU" | "DEPRECATED";

export interface Finding {
  file: string;
  line: number;
  severity: Severity;
  category: Category;
  rule: string;
  message: string;
  suggestion: string;
  snippet: string;
}

export interface AuditSummary {
  scannedFiles: number;
  findings: Finding[];
  startedAt: string;
  finishedAt: string;
  rootPath: string;
}

const SEVERITY_ORDER: Record<Severity, number> = {
  CRITICAL: 0,
  WARNING: 1,
  INFO: 2,
};

const SEVERITY_BADGE: Record<Severity, string> = {
  CRITICAL: "[CRITICAL]",
  WARNING: "[WARNING]",
  INFO: "[INFO]",
};

function groupBy<T, K extends string>(
  items: T[],
  key: (item: T) => K,
): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = out.get(k);
    if (arr) arr.push(it);
    else out.set(k, [it]);
  }
  return out;
}

export function renderReport(summary: AuditSummary): string {
  const lines: string[] = [];
  const counts: Record<Severity, number> = {
    CRITICAL: 0,
    WARNING: 0,
    INFO: 0,
  };
  for (const f of summary.findings) counts[f.severity] += 1;

  lines.push("# Zama Audit Report");
  lines.push("");
  lines.push(`- **Root**: \`${summary.rootPath}\``);
  lines.push(`- **Scanned files**: ${summary.scannedFiles}`);
  lines.push(`- **Started**: ${summary.startedAt}`);
  lines.push(`- **Finished**: ${summary.finishedAt}`);
  lines.push("");
  lines.push("## Totals");
  lines.push("");
  lines.push("| Severity | Count |");
  lines.push("| --- | --- |");
  lines.push(`| CRITICAL | ${counts.CRITICAL} |`);
  lines.push(`| WARNING  | ${counts.WARNING} |`);
  lines.push(`| INFO     | ${counts.INFO} |`);
  lines.push(`| **TOTAL** | **${summary.findings.length}** |`);
  lines.push("");

  if (summary.findings.length === 0) {
    lines.push("## Result");
    lines.push("");
    lines.push(
      "No FHE-aware issues detected. The audit covered ACL grants, cleartext leaks, HCU thresholds, and deprecated imports.",
    );
    lines.push("");
    return lines.join("\n");
  }

  // Sort: severity then file then line
  const sorted = [...summary.findings].sort((a, b) => {
    if (SEVERITY_ORDER[a.severity] !== SEVERITY_ORDER[b.severity]) {
      return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    }
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.line - b.line;
  });

  // Per-file summary table
  lines.push("## Per-file summary");
  lines.push("");
  lines.push("| File | CRITICAL | WARNING | INFO |");
  lines.push("| --- | --- | --- | --- |");
  const byFile = groupBy(sorted, (f) => f.file);
  const fileNames = [...byFile.keys()].sort();
  for (const file of fileNames) {
    const fs = byFile.get(file) ?? [];
    const c = fs.filter((f) => f.severity === "CRITICAL").length;
    const w = fs.filter((f) => f.severity === "WARNING").length;
    const inf = fs.filter((f) => f.severity === "INFO").length;
    lines.push(`| \`${file}\` | ${c} | ${w} | ${inf} |`);
  }
  lines.push("");

  // Findings grouped by severity
  for (const sev of ["CRITICAL", "WARNING", "INFO"] as const) {
    const subset = sorted.filter((f) => f.severity === sev);
    if (subset.length === 0) continue;
    lines.push(`## ${SEVERITY_BADGE[sev]} ${sev} (${subset.length})`);
    lines.push("");
    for (const f of subset) {
      lines.push(`### \`${f.file}:${f.line}\` — ${f.rule}`);
      lines.push("");
      lines.push(`**Category**: ${f.category}`);
      lines.push("");
      lines.push(f.message);
      lines.push("");
      lines.push("```solidity");
      lines.push(f.snippet);
      lines.push("```");
      lines.push("");
      lines.push(`**Suggested fix**: ${f.suggestion}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}
