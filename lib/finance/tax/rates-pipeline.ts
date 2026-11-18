import { createHash } from "node:crypto";
import { prisma } from "@/lib/finance/prisma";
import { defaultTablesForYear, normalizeTables } from "./params";
import type { YearTaxTables } from "./types";
import { defaultTaxYear } from "./year";

export type RateSourceStatus =
  | "unchanged"
  | "proposed"
  | "unavailable"
  | "needs_manual"
  | "available_unparsed";

export type RateSourceProbe = {
  id: string;
  jurisdiction: "federal" | "CA" | "CO" | "NY" | "NYC";
  label: string;
  url: string;
  status: RateSourceStatus;
  httpStatus?: number;
  excerptHash?: string;
  note?: string;
};

export type RatesRefreshResult = {
  year: number;
  sources: RateSourceProbe[];
  candidate: YearTaxTables;
  current: YearTaxTables | null;
  hasProposed: boolean;
  summaryLines: string[];
};

const SOURCES: {
  id: string;
  jurisdiction: RateSourceProbe["jurisdiction"];
  label: string;
  urlForYear: (year: number) => string;
}[] = [
  {
    id: "irs-rev-proc",
    jurisdiction: "federal",
    label: "IRS inflation adjustments / Rev. Proc. search",
    urlForYear: (y) =>
      `https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-${y}`,
  },
  {
    id: "ftb-brackets",
    jurisdiction: "CA",
    label: "FTB California tax rates / brackets",
    urlForYear: (y) =>
      `https://www.ftb.ca.gov/forms/${y}/${y}-540-booklet.html`,
  },
  {
    id: "co-book104",
    jurisdiction: "CO",
    label: "Colorado Book 104 / income tax rate",
    urlForYear: (y) =>
      `https://tax.colorado.gov/sites/default/files/documents/Book104_${y}.pdf`,
  },
  {
    id: "ny-it201",
    jurisdiction: "NY",
    label: "NY IT-201 instructions / rates",
    urlForYear: () =>
      "https://www.tax.ny.gov/forms/current-forms/it201.htm",
  },
  {
    id: "nyc-rates",
    jurisdiction: "NYC",
    label: "NYC resident tax rates (via NY Tax)",
    urlForYear: () =>
      "https://www.tax.ny.gov/pit/file/tax_tables.htm",
  },
];

async function probeUrl(url: string): Promise<{
  ok: boolean;
  status: number;
  bodySnippet: string;
}> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "user-agent": "financial-health-rates-pipeline/1.0" },
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      bodySnippet: text.slice(0, 4000),
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      bodySnippet: err instanceof Error ? err.message : "fetch failed",
    };
  }
}

function hashSnippet(s: string) {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

/** Probe official sources and diff against TaxYearParams / code defaults. */
export async function runRatesRefresh(opts?: {
  year?: number;
}): Promise<RatesRefreshResult> {
  const year = opts?.year ?? defaultTaxYear();
  const candidate = defaultTablesForYear(year);
  const params = await prisma.taxYearParams.findUnique({ where: { year } });
  let current: YearTaxTables | null = null;
  if (params?.tablesJson && params.tablesJson !== "{}") {
    try {
      current = normalizeTables(
        JSON.parse(params.tablesJson) as YearTaxTables,
      );
    } catch {
      current = null;
    }
  }

  const sources: RateSourceProbe[] = [];
  for (const src of SOURCES) {
    const url = src.urlForYear(year);
    const probed = await probeUrl(url);
    if (!probed.ok) {
      sources.push({
        id: src.id,
        jurisdiction: src.jurisdiction,
        label: src.label,
        url,
        status: "unavailable",
        httpStatus: probed.status,
        note: probed.bodySnippet.slice(0, 120),
      });
      continue;
    }
    const excerptHash = hashSnippet(probed.bodySnippet);
    // We do not auto-parse PDF/HTML into brackets yet — flag for manual apply.
    sources.push({
      id: src.id,
      jurisdiction: src.jurisdiction,
      label: src.label,
      url,
      status: "available_unparsed",
      httpStatus: probed.status,
      excerptHash,
      note: "Source reachable — review and update params.ts / apply with tax:refresh-rates --apply",
    });
  }

  const tablesDiffer =
    current != null &&
    JSON.stringify(current.federal.standardDeduction) !==
      JSON.stringify(candidate.federal.standardDeduction);

  const hasProposed = sources.some(
    (s) => s.status === "available_unparsed" || s.status === "proposed",
  );

  if (tablesDiffer) {
    for (const s of sources) {
      if (s.status === "available_unparsed") s.status = "proposed";
    }
  }

  const summaryLines = [
    `Tax year ${year} rates probe`,
    ...sources.map(
      (s) =>
        `${s.jurisdiction}: ${s.status}${s.httpStatus ? ` (HTTP ${s.httpStatus})` : ""} — ${s.url}`,
    ),
    tablesDiffer
      ? "Code defaults differ from TaxYearParams — candidate ready to apply after review."
      : "TaxYearParams match code defaults (or missing) — still confirm official pubs.",
  ];

  return {
    year,
    sources,
    candidate,
    current,
    hasProposed: hasProposed || tablesDiffer,
    summaryLines,
  };
}

/** Persist candidate tables into TaxYearParams (human --apply gate). */
export async function applyRatesCandidate(year: number, tables?: YearTaxTables) {
  const candidate = normalizeTables(tables ?? defaultTablesForYear(year));
  const existing = await prisma.taxYearParams.findUnique({ where: { year } });
  const data = {
    standardDeduction: candidate.federal.standardDeduction.single,
    ssWageBase: candidate.se.ssWageBase,
    seSocialSecurityRate: candidate.se.ssRate,
    seMedicareRate: candidate.se.medicareRate,
    federalBracketsJson: JSON.stringify(candidate.federal.brackets.single),
    caBracketsJson: JSON.stringify(candidate.states.CA.brackets.single),
    caMentalHealthRate: candidate.states.CA.mentalHealthRate ?? 0.01,
    caMentalHealthThreshold:
      candidate.states.CA.mentalHealthThreshold ?? 1_000_000,
    qbiSimpleRate: candidate.federal.qbi.rate,
    tablesJson: JSON.stringify(candidate),
    notes: `Rates applied ${new Date().toISOString().slice(0, 10)} from defaultTablesForYear(${year}). Also update params.ts if code defaults changed.`,
  };
  if (existing) {
    return prisma.taxYearParams.update({ where: { year }, data });
  }
  return prisma.taxYearParams.create({ data: { year, ...data } });
}

/** Create a Coach insight for proposed rates (no auto-apply). */
export async function proposeRatesInsight(result: RatesRefreshResult) {
  if (!result.hasProposed && !result.sources.some((s) => s.status === "available_unparsed")) {
    return { created: false as const, reason: "nothing_to_propose" };
  }

  const title = `Tax rates check for ${result.year}`;
  const body = [
    ...result.summaryLines,
    "",
    "Propose-only: run `npm run tax:refresh-rates -- --year=" +
      result.year +
      " --apply` after updating params.ts from official pubs.",
    "",
    "Sources:",
    ...result.sources.map((s) => `- ${s.label}: ${s.url} [${s.status}]`),
  ].join("\n");

  // Avoid duplicate open insights for same year
  const existing = await prisma.agentInsight.findMany({
    where: {
      status: "proposed",
      kind: "tax_rates_proposed",
    },
    take: 20,
  });
  const dup = existing.find((i) => i.title === title);
  if (dup) {
    await prisma.agentInsight.update({
      where: { id: dup.id },
      data: {
        body,
        payload: JSON.stringify({
          year: result.year,
          sources: result.sources,
          candidate: result.candidate,
        }),
      },
    });
    return { created: false as const, updatedId: dup.id, reason: "updated" };
  }

  const created = await prisma.agentInsight.create({
    data: {
      kind: "tax_rates_proposed",
      status: "proposed",
      title,
      body,
      confidence: 0.5,
      payload: JSON.stringify({
        year: result.year,
        sources: result.sources,
        candidate: result.candidate,
      }),
    },
  });
  return { created: true as const, id: created.id };
}
