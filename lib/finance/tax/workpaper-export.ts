import { fromCents } from "@/lib/finance/agent-money";
import type { TaxComputation, WorkpaperLine } from "./types";

/** Markdown workpaper export — same map Phase 3 PDF fill will use. */
export function workpapersToMarkdown(computation: TaxComputation): string {
  const lines: string[] = [
    `# Tax workpapers · ${computation.year}`,
    "",
    `Filing status: **${computation.filingStatus}** · Resident: **${computation.residentState}**`,
    "",
    `Combined total tax: **$${computation.combined.totalTax.usd.toFixed(2)}**`,
    `Federal: $${computation.federal.totalTax.usd.toFixed(2)} · California: $${computation.california.totalTax.usd.toFixed(2)}`,
    "",
  ];

  if (computation.limitations.length) {
    lines.push("## Limitations", "");
    for (const n of computation.limitations) lines.push(`- ${n}`);
    lines.push("");
  }

  lines.push("## Calculation steps", "");
  for (const step of computation.steps) {
    lines.push(`### ${step.title}`);
    if (step.description) lines.push(step.description);
    if (step.federalCents != null) {
      lines.push(`- Federal: $${fromCents(step.federalCents).toFixed(2)}`);
    }
    if (step.californiaCents != null) {
      lines.push(`- California: $${fromCents(step.californiaCents).toFixed(2)}`);
    }
    if (step.details?.length) {
      for (const d of step.details) {
        lines.push(`  - ${d.label}: $${fromCents(d.amountCents).toFixed(2)}`);
      }
    }
    lines.push("");
  }

  lines.push("## Forms", "");
  const byForm = groupByForm(computation.workpapers);
  for (const [key, rows] of byForm) {
    const [jurisdiction, form] = key.split("::");
    lines.push(`### ${form} (${jurisdiction})`, "");
    lines.push("| Line | Label | Amount |");
    lines.push("| --- | --- | ---: |");
    for (const r of rows) {
      lines.push(
        `| ${r.line} | ${r.label} | $${fromCents(r.amountCents).toFixed(2)} |`,
      );
    }
    lines.push("");
  }

  lines.push(
    "---",
    "",
    "_Field map for future PDF fill: `form` + `line` on each workpaper row._",
    "",
  );

  return lines.join("\n");
}

function groupByForm(workpapers: WorkpaperLine[]) {
  const map = new Map<string, WorkpaperLine[]>();
  for (const w of workpapers) {
    const key = `${w.jurisdiction}::${w.form}`;
    const list = map.get(key) ?? [];
    list.push(w);
    map.set(key, list);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}
