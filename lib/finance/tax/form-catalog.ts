/**
 * Official IRS / FTB blank PDF catalog for the scoped (2A) return packet.
 * PDFs are cached under tax-forms/{year}/ — not committed to git.
 *
 * Federal forms prefer year-pinned irs-prior URLs so the selected tax year
 * never silently picks up the "current" draft from irs-pdf/.
 */

export type CatalogForm = {
  /** Workpaper / packet form name (must match compute.ts `form` values). */
  form: string;
  jurisdiction: "federal" | "CA" | "CO" | "NY" | "NYC";
  /** Local filename under tax-forms/{year}/ */
  fileName: string;
  /**
   * IRS pub slug without extension, e.g. "f1040" / "f1040sc".
   * Used to build year-pinned prior URLs.
   */
  irsSlug?: string;
  /** Default download URL (may include {year} / {slug}). */
  url: string;
  /** Optional per-year URL overrides when FTB/IRS slug differs. */
  urlByYear?: Record<number, string>;
  /** Alternate FTB/IRS candidates to try on 404. */
  fallbackUrls?: string[];
};

/** Instruction booklets (evidence for yearly spine refresh; not filled). */
export type CatalogInstruction = {
  /** Matches CatalogForm.form when applicable */
  form: string;
  fileName: string;
  /** IRS instruction slug, e.g. "i1040sc" */
  irsSlug?: string;
  url: string;
  fallbackUrls?: string[];
};

const IRS = "https://www.irs.gov/pub/irs-pdf";
const IRS_PRIOR = "https://www.irs.gov/pub/irs-prior";

function irsForm(slug: string): Pick<CatalogForm, "irsSlug" | "url" | "fallbackUrls"> {
  return {
    irsSlug: slug,
    // Prefer year-pinned prior; current irs-pdf/ is a last resort (year-checked).
    url: `${IRS_PRIOR}/${slug}--{year}.pdf`,
    fallbackUrls: [`${IRS}/${slug}.pdf`],
  };
}

/** Spine instruction PDFs used by tax:refresh-spine. */
export const INSTRUCTION_CATALOG: CatalogInstruction[] = [
  {
    form: "1040",
    fileName: "i1040.pdf",
    irsSlug: "i1040gi",
    url: `${IRS_PRIOR}/i1040gi--{year}.pdf`,
    fallbackUrls: [
      `${IRS_PRIOR}/i1040--{year}.pdf`,
      `${IRS}/i1040gi.pdf`,
      `${IRS}/i1040.pdf`,
    ],
  },
  {
    form: "Schedule 1",
    fileName: "i1040s1.pdf",
    irsSlug: "i1040s1",
    url: `${IRS_PRIOR}/i1040s1--{year}.pdf`,
    fallbackUrls: [`${IRS}/i1040s1.pdf`],
  },
  {
    form: "Schedule C",
    fileName: "i1040sc.pdf",
    irsSlug: "i1040sc",
    url: `${IRS_PRIOR}/i1040sc--{year}.pdf`,
    fallbackUrls: [`${IRS}/i1040sc.pdf`],
  },
  {
    form: "Schedule SE",
    fileName: "i1040sse.pdf",
    irsSlug: "i1040sse",
    url: `${IRS_PRIOR}/i1040sse--{year}.pdf`,
    fallbackUrls: [`${IRS}/i1040sse.pdf`],
  },
];

export const FORM_CATALOG: CatalogForm[] = [
  {
    form: "1040",
    jurisdiction: "federal",
    fileName: "1040.pdf",
    ...irsForm("f1040"),
  },
  {
    form: "Schedule 1",
    jurisdiction: "federal",
    fileName: "schedule-1.pdf",
    ...irsForm("f1040s1"),
  },
  {
    form: "Schedule 2",
    jurisdiction: "federal",
    fileName: "schedule-2.pdf",
    ...irsForm("f1040s2"),
  },
  {
    form: "Schedule B",
    jurisdiction: "federal",
    fileName: "schedule-b.pdf",
    ...irsForm("f1040sb"),
  },
  {
    form: "Schedule C",
    jurisdiction: "federal",
    fileName: "schedule-c.pdf",
    ...irsForm("f1040sc"),
  },
  {
    form: "Schedule D",
    jurisdiction: "federal",
    fileName: "schedule-d.pdf",
    ...irsForm("f1040sd"),
  },
  {
    form: "Schedule SE",
    jurisdiction: "federal",
    fileName: "schedule-se.pdf",
    ...irsForm("f1040sse"),
  },
  {
    form: "Form 8949",
    jurisdiction: "federal",
    fileName: "form-8949.pdf",
    ...irsForm("f8949"),
  },
  {
    form: "Form 8995",
    jurisdiction: "federal",
    fileName: "form-8995.pdf",
    ...irsForm("f8995"),
  },
  {
    form: "8959",
    jurisdiction: "federal",
    fileName: "form-8959.pdf",
    ...irsForm("f8959"),
  },
  {
    form: "8960",
    jurisdiction: "federal",
    fileName: "form-8960.pdf",
    ...irsForm("f8960"),
  },
  {
    form: "QD/LTCG Worksheet",
    jurisdiction: "federal",
    fileName: "qd-ltcg-worksheet.pdf",
    // No standalone IRS fillable; filled via generated page / 1040 tax line.
    url: "",
  },
  {
    form: "540",
    jurisdiction: "CA",
    fileName: "540.pdf",
    url: "https://www.ftb.ca.gov/forms/{year}/{year}-540.pdf",
    fallbackUrls: [
      "https://www.ftb.ca.gov/forms/{year}/{year}-540-form-only.pdf",
    ],
  },
  {
    form: "Schedule CA (540)",
    jurisdiction: "CA",
    fileName: "schedule-ca-540.pdf",
    url: "https://www.ftb.ca.gov/forms/{year}/{year}-540-ca.pdf",
    fallbackUrls: [
      "https://www.ftb.ca.gov/forms/{year}/{year}-540-schedule-ca.pdf",
      "https://www.ftb.ca.gov/forms/{year}/{year}-540ca.pdf",
    ],
  },
  {
    form: "CO-104",
    jurisdiction: "CO",
    fileName: "co-104.pdf",
    // Colorado booklet / form — generated fallback until blank download works
    url: "https://tax.colorado.gov/sites/default/files/documents/DR0104_{year}.pdf",
    fallbackUrls: [
      "https://tax.colorado.gov/sites/default/files/DR0104.pdf",
    ],
  },
  {
    form: "IT-201",
    jurisdiction: "NY",
    fileName: "it-201.pdf",
    url: "https://www.tax.ny.gov/pdf/current_forms/it/it201_fill_in.pdf",
    fallbackUrls: [
      "https://www.tax.ny.gov/forms/current-forms/it201.htm",
    ],
  },
  {
    form: "IT-201 NYC",
    jurisdiction: "NYC",
    fileName: "it-201-nyc.pdf",
    // NYC tax is computed on IT-201; no separate blank — generated page
    url: "",
  },
];

export function catalogEntryForForm(form: string): CatalogForm | undefined {
  return FORM_CATALOG.find((f) => f.form === form);
}

/**
 * Candidate download URLs for a catalog entry + tax year.
 * Federal: year-pinned irs-prior first, then current irs-pdf fallback.
 */
export function resolveCatalogUrl(entry: CatalogForm, year: number): string[] {
  const override = entry.urlByYear?.[year];
  const primary = (override || entry.url).replaceAll("{year}", String(year));
  const fallbacks = (entry.fallbackUrls ?? []).map((u) =>
    u.replaceAll("{year}", String(year)),
  );
  const ordered = [primary, ...fallbacks].filter(Boolean);
  // De-dupe while preserving order
  return [...new Set(ordered)];
}

export function resolveInstructionUrls(
  entry: CatalogInstruction,
  year: number,
): string[] {
  const urls = [entry.url, ...(entry.fallbackUrls ?? [])].map((u) =>
    u.replaceAll("{year}", String(year)),
  );
  return [...new Set(urls.filter(Boolean))];
}

/**
 * Best-effort tax year stamped on an IRS/FTB blank (from raw PDF bytes).
 * Returns null when no clear form-year marker is found.
 */
export function detectPdfFormYear(bytes: Buffer | Uint8Array): number | null {
  const text = Buffer.from(bytes).toString("latin1");
  const patterns = [
    /\b(20\d{2})\s+Schedule\s+[A-Z0-9]/i,
    /\b(20\d{2})\s+Form\s+\d+/i,
    /\bForm\s+1040\s*\((20\d{2})\)/i,
    /Schedule\s+[A-Z0-9]+\s*\(Form\s+1040\)\s+(20\d{2})/i,
    /TAXABLE\s+YEAR\s+(20\d{2})/i,
    /California\s+Resident\s+Income\s+Tax\s+Return[^\n]{0,80}(20\d{2})/i,
    /\bForm\s+540\s+(20\d{2})\b/i,
  ];
  const found = new Map<number, number>();
  for (const re of patterns) {
    const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
    const global = new RegExp(re.source, flags);
    let m: RegExpExecArray | null;
    while ((m = global.exec(text)) !== null) {
      const y = Number(m[1]);
      if (y >= 2018 && y <= 2100) {
        found.set(y, (found.get(y) ?? 0) + 1);
      }
      if (found.size > 8) break;
    }
  }
  if (found.size === 0) return null;
  // Prefer the year with the most title-like hits
  return [...found.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

export function pdfMatchesTaxYear(
  bytes: Buffer | Uint8Array,
  year: number,
): { ok: boolean; detected: number | null } {
  const detected = detectPdfFormYear(bytes);
  if (detected == null) {
    // Some worksheets lack a clear stamp — allow if caller uses year-pinned URL.
    return { ok: true, detected: null };
  }
  return { ok: detected === year, detected };
}

export function formSlug(form: string) {
  return form
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function taxFormsRoot() {
  return `${process.cwd()}/tax-forms`;
}

export function blankDir(year: number) {
  return `${taxFormsRoot()}/${year}`;
}

export function blankFilePath(year: number, entry: CatalogForm) {
  return `${blankDir(year)}/${entry.fileName}`;
}

export function instructionDir(year: number) {
  return `${blankDir(year)}/instructions`;
}

export function instructionFilePath(year: number, entry: CatalogInstruction) {
  return `${instructionDir(year)}/${entry.fileName}`;
}
