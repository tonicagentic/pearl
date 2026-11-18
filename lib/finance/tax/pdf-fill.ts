/**
 * Fill printable federal + CA return PDFs from workpapers + filer identity.
 *
 * Prefers official IRS/FTB blanks in tax-forms/{year}/ with curated AcroForm
 * bindings. Falls back to generated layout pages when a blank/binding is missing.
 */
import { readFile, readdir, access } from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFForm,
  type PDFPage,
} from "pdf-lib";
import JSZip from "jszip";
import { fromCents } from "@/lib/finance/agent-money";
import type { TaxComputation, TaxFilerIdentity, WorkpaperLine } from "./types";
import {
  blankFilePath,
  catalogEntryForForm,
  formSlug,
  pdfMatchesTaxYear,
  taxFormsRoot,
} from "./form-catalog";
import { ensureBlanksForForms } from "./fetch-forms";
import {
  loadYearBindings,
  type BindingValue,
  type FormBindings,
} from "./form-bindings";
import {
  loadSpinePack,
  reconcileWorkpapers,
  spineForms,
  type ReconcileResult,
} from "./form-specs";

export type PdfFieldBinding = {
  form: string;
  line: string;
  pdfField: string;
};

/** @deprecated Use year bindings in form-bindings/ — kept for callers. */
export const PDF_FIELD_BINDINGS: PdfFieldBinding[] = [];

function moneyPlain(cents: number) {
  const n = fromCents(cents);
  return n.toFixed(2);
}

function moneyLabel(cents: number) {
  return fromCents(cents).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatSsn(ssn: string, withDashes = true) {
  const d = ssn.replace(/\D/g, "");
  if (d.length !== 9) return ssn || "";
  return withDashes ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : d;
}

function splitName(legalName: string): { first: string; last: string } {
  const parts = legalName.trim().split(/\s+/);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1]! };
}

export function workpapersForPdf(
  workpapers: WorkpaperLine[],
  year = new Date().getFullYear(),
) {
  const bindings = loadYearBindings(year)?.forms ?? {};
  return workpapers.map((w) => {
    const formMap = bindings[w.form];
    const raw = formMap?.[`line.${w.line}`];
    const pdfField =
      typeof raw === "string" ? raw : raw && "field" in raw ? raw.field : undefined;
    return { ...w, binding: pdfField ? { form: w.form, line: w.line, pdfField } : undefined };
  });
}

export function formsInPacket(computation: TaxComputation) {
  return computation.forms.map((f) => ({
    form: f.form,
    jurisdiction: f.jurisdiction,
    lineCount: f.lineCount,
    slug: formSlug(f.form),
  }));
}

async function fileExists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function setText(form: PDFForm, fieldName: string, value: string) {
  try {
    form.getTextField(fieldName).setText(value);
    return true;
  } catch {
    return false;
  }
}

function setCheck(form: PDFForm, fieldName: string, on: boolean) {
  try {
    const box = form.getCheckBox(fieldName);
    if (on) box.check();
    else box.uncheck();
    return true;
  } catch {
    return false;
  }
}

function bindingFieldName(binding: BindingValue) {
  return typeof binding === "string" ? binding : binding.field;
}

function fieldExists(form: PDFForm, fieldName: string) {
  try {
    form.getField(fieldName);
    return true;
  } catch {
    return false;
  }
}

function applyBinding(
  form: PDFForm,
  binding: BindingValue,
  value: string | boolean,
) {
  const name = bindingFieldName(binding);
  // Gate: never write when the AcroForm field is missing (avoids silent no-ops
  // being confused with success). Wrong-but-present paths still require
  // inventory/spec tests to catch.
  if (!fieldExists(form, name)) return false;
  if (typeof binding === "string") {
    if (typeof value === "boolean") return setCheck(form, binding, value);
    return setText(form, binding, value);
  }
  if (binding.type === "checkbox") {
    return setCheck(form, binding.field, Boolean(value));
  }
  return setText(form, binding.field, String(value));
}

function identityValues(
  filer: TaxFilerIdentity | null,
  filingStatus: string,
): Record<string, string | boolean> {
  if (!filer) return {};
  const name = splitName(filer.legalName);
  const spouse = splitName(filer.spouseLegalName);
  return {
    "identity.legalName": filer.legalName,
    "identity.firstName": name.first,
    "identity.lastName": name.last,
    "identity.ssn": formatSsn(filer.ssn),
    "identity.occupation": filer.occupation,
    "identity.addressLine1": filer.addressLine1,
    "identity.addressLine2": filer.addressLine2,
    "identity.city": filer.city,
    "identity.state": filer.state,
    "identity.zip": filer.zip,
    "identity.phone": filer.phone,
    "identity.spouseLegalName": filer.spouseLegalName,
    "identity.spouseFirstName": spouse.first,
    "identity.spouseLastName": spouse.last,
    "identity.spouseSsn": formatSsn(filer.spouseSsn),
    "filingStatus.single": filingStatus === "single",
    "filingStatus.mfj": filingStatus === "mfj",
    "filingStatus.mfs": filingStatus === "mfs",
    "filingStatus.hoh": filingStatus === "hoh",
  };
}

async function tryAcroFormFill(opts: {
  year: number;
  form: string;
  lines: WorkpaperLine[];
  filer: TaxFilerIdentity | null;
  filingStatus: string;
  formBindings?: FormBindings;
}): Promise<{ bytes: Uint8Array; boundLines: string[]; unbound: WorkpaperLine[] } | null> {
  const entry = catalogEntryForForm(opts.form);
  if (!entry) return null;
  const p = blankFilePath(opts.year, entry);
  if (!(await fileExists(p))) return null;

  const bindings = opts.formBindings;
  if (!bindings || Object.keys(bindings).length === 0) return null;

  try {
    const bytes = await readFile(p);
    const yearMatch = pdfMatchesTaxYear(bytes, opts.year);
    if (!yearMatch.ok) {
      // Refuse to fill a blank stamped for a different tax year.
      return null;
    }
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const form = doc.getForm();

    const idVals = identityValues(opts.filer, opts.filingStatus);
    for (const [key, val] of Object.entries(idVals)) {
      const b = bindings[key];
      if (!b) continue;
      applyBinding(form, b, val);
    }

    const boundLines: string[] = [];
    const unbound: WorkpaperLine[] = [];
    for (const line of opts.lines) {
      const b = bindings[`line.${line.line}`];
      if (!b) {
        unbound.push(line);
        continue;
      }
      const ok = applyBinding(form, b, moneyPlain(line.amountCents));
      if (ok) boundLines.push(line.line);
      else unbound.push(line);
    }

    try {
      form.flatten();
    } catch {
      /* some FTB forms resist flatten */
    }
    return { bytes: await doc.save(), boundLines, unbound };
  } catch {
    return null;
  }
}

function drawHeader(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  opts: {
    title: string;
    year: number;
    filer: TaxFilerIdentity | null;
    jurisdiction: string;
  },
) {
  const { width, height } = page.getSize();
  let y = height - 48;
  page.drawText(opts.title, {
    x: 48,
    y,
    size: 16,
    font: bold,
    color: rgb(0.1, 0.1, 0.12),
  });
  y -= 18;
  page.drawText(
    `Tax year ${opts.year} · ${opts.jurisdiction} · For review — not e-filed`,
    {
      x: 48,
      y,
      size: 9,
      font,
      color: rgb(0.35, 0.35, 0.4),
    },
  );
  y -= 22;
  if (opts.filer?.legalName) {
    page.drawText(opts.filer.legalName, {
      x: 48,
      y,
      size: 11,
      font: bold,
    });
    y -= 14;
    if (opts.filer.ssn) {
      page.drawText(`SSN ${formatSsn(opts.filer.ssn)}`, {
        x: 48,
        y,
        size: 9,
        font,
      });
      y -= 12;
    }
    const addr = [
      opts.filer.addressLine1,
      opts.filer.addressLine2,
      [opts.filer.city, opts.filer.state, opts.filer.zip].filter(Boolean).join(", "),
    ]
      .filter(Boolean)
      .join(" · ");
    if (addr) {
      page.drawText(addr.slice(0, 100), { x: 48, y, size: 9, font });
      y -= 12;
    }
  }
  page.drawLine({
    start: { x: 48, y: y - 4 },
    end: { x: width - 48, y: y - 4 },
    thickness: 0.75,
    color: rgb(0.75, 0.75, 0.78),
  });
  return y - 20;
}

async function renderGeneratedPage(opts: {
  form: string;
  jurisdiction: string;
  year: number;
  lines: WorkpaperLine[];
  filer: TaxFilerIdentity | null;
  limitations: string[];
  subtitle?: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([612, 792]);
  let y = drawHeader(page, font, bold, {
    title: opts.form,
    year: opts.year,
    filer: opts.filer,
    jurisdiction: opts.jurisdiction,
  });

  if (opts.subtitle) {
    page.drawText(opts.subtitle, {
      x: 48,
      y,
      size: 9,
      font: bold,
      color: rgb(0.55, 0.2, 0.1),
    });
    y -= 16;
  }

  const colLine = 48;
  const colLabel = 110;
  const colAmt = 520;
  page.drawText("Line", { x: colLine, y, size: 9, font: bold });
  page.drawText("Description", { x: colLabel, y, size: 9, font: bold });
  page.drawText("Amount", { x: colAmt - 40, y, size: 9, font: bold });
  y -= 14;

  for (const row of opts.lines) {
    if (y < 72) {
      page = doc.addPage([612, 792]);
      y = drawHeader(page, font, bold, {
        title: `${opts.form} (cont.)`,
        year: opts.year,
        filer: opts.filer,
        jurisdiction: opts.jurisdiction,
      });
    }
    page.drawText(String(row.line).slice(0, 14), {
      x: colLine,
      y,
      size: 9,
      font,
    });
    page.drawText(row.label.slice(0, 55), {
      x: colLabel,
      y,
      size: 9,
      font,
    });
    const amt = moneyLabel(row.amountCents);
    page.drawText(amt, {
      x: colAmt - font.widthOfTextAtSize(amt, 9),
      y,
      size: 9,
      font,
    });
    y -= 13;
  }

  return doc.save();
}

export type FilledPacketFile = {
  fileName: string;
  form: string;
  jurisdiction: string;
  bytes: Uint8Array;
  usedOfficialBlank: boolean;
};

export type FillPacketResult = {
  files: FilledPacketFile[];
  formStatus: {
    form: string;
    jurisdiction: string;
    usedOfficialBlank: boolean;
    boundLineCount: number;
    unboundLineCount: number;
  }[];
  fetchNotes: string[];
  reconcile: ReconcileResult | null;
  /** True when spine reconcile passed (or no spine pack). */
  clean: boolean;
};

/** Build per-form PDFs for the 2A packet (official blanks preferred). */
export async function fillReturnPacket(opts: {
  computation: TaxComputation;
  filer: TaxFilerIdentity | null;
  /** Skip network fetch of missing blanks */
  skipFetch?: boolean;
}): Promise<FillPacketResult> {
  const { computation, filer } = opts;
  const year = computation.year;
  const yearBindings = loadYearBindings(year);
  const spine = loadSpinePack(year);
  const fetchNotes: string[] = [];

  const reconcile = spine
    ? reconcileWorkpapers(computation.workpapers, spine)
    : null;
  if (reconcile && !reconcile.ok) {
    for (const f of reconcile.failures.slice(0, 12)) {
      fetchNotes.push(`Reconcile: ${f.message}`);
    }
  }

  const formNames = computation.forms.map((f) => f.form);
  if (!opts.skipFetch) {
    try {
      const fetched = await ensureBlanksForForms(year, formNames);
      for (const r of fetched) {
        if (r.status === "downloaded") {
          fetchNotes.push(`Downloaded official blank: ${r.form}`);
        } else if (r.status === "failed") {
          fetchNotes.push(`Could not download ${r.form}: ${r.error ?? "error"}`);
        }
      }
    } catch (err) {
      fetchNotes.push(
        `Blank fetch skipped/failed: ${err instanceof Error ? err.message : "error"}`,
      );
    }
  }

  const byForm = new Map<string, WorkpaperLine[]>();
  for (const w of computation.workpapers) {
    const key = `${w.jurisdiction}::${w.form}`;
    const list = byForm.get(key) ?? [];
    list.push(w);
    byForm.set(key, list);
  }

  const files: FilledPacketFile[] = [];
  const formStatus: FillPacketResult["formStatus"] = [];
  const allUnbound: WorkpaperLine[] = [];

  for (const [key, lines] of byForm) {
    const [jurisdiction, form] = key.split("::") as [string, string];
    const formBindings = yearBindings?.forms[form];
    const filled = await tryAcroFormFill({
      year,
      form,
      lines,
      filer,
      filingStatus: computation.filingStatus,
      formBindings,
    });

    const slug = formSlug(form);
    if (filled) {
      files.push({
        fileName: `${year}-${jurisdiction}-${slug}.pdf`,
        form,
        jurisdiction,
        bytes: filled.bytes,
        usedOfficialBlank: true,
      });
      formStatus.push({
        form,
        jurisdiction,
        usedOfficialBlank: true,
        boundLineCount: filled.boundLines.length,
        unboundLineCount: filled.unbound.length,
      });
      allUnbound.push(...filled.unbound);
    } else {
      const bytes = await renderGeneratedPage({
        form,
        jurisdiction,
        year,
        lines,
        filer,
        limitations: computation.limitations,
        subtitle:
          "Generated layout (official blank missing or unmapped) — not an IRS/FTB form image",
      });
      files.push({
        fileName: `${year}-${jurisdiction}-${slug}.pdf`,
        form,
        jurisdiction,
        bytes,
        usedOfficialBlank: false,
      });
      formStatus.push({
        form,
        jurisdiction,
        usedOfficialBlank: false,
        boundLineCount: 0,
        unboundLineCount: lines.length,
      });
    }
  }

  if (allUnbound.length > 0) {
    const bytes = await renderGeneratedPage({
      form: "Unbound lines",
      jurisdiction: "combined",
      year,
      lines: allUnbound,
      filer,
      limitations: [],
      subtitle:
        "These workpaper lines had no AcroForm binding on the official blank",
    });
    files.push({
      fileName: `${year}-unbound-lines.pdf`,
      form: "Unbound lines",
      jurisdiction: "combined",
      bytes,
      usedOfficialBlank: false,
    });
  }

  if (reconcile && !reconcile.ok) {
    const bytes = await renderGeneratedPage({
      form: "Reconcile failures",
      jurisdiction: "combined",
      year,
      lines: reconcile.failures.map((f) => ({
        jurisdiction: "federal" as const,
        form: f.form,
        line: f.lineId,
        label: f.message.slice(0, 80),
        amountCents: f.deltaCents,
        stepId: "reconcile",
      })),
      filer,
      limitations: [],
      subtitle:
        "Spine instruction rules failed — packet is for review only (not clean)",
    });
    files.push({
      fileName: `${year}-reconcile-failures.pdf`,
      form: "Reconcile failures",
      jurisdiction: "combined",
      bytes,
      usedOfficialBlank: false,
    });
  }

  const clean = !reconcile || reconcile.ok;
  const cover = await renderCover({
    computation,
    filer,
    formStatus,
    fetchNotes,
    bindingNotes: yearBindings?.notes ?? [],
    reconcile,
    clean,
    spineForms: spineForms(year),
  });
  files.unshift({
    fileName: `${year}-cover.pdf`,
    form: "Cover",
    jurisdiction: "combined",
    bytes: cover,
    usedOfficialBlank: false,
  });

  return { files, formStatus, fetchNotes, reconcile, clean };
}

async function renderCover(opts: {
  computation: TaxComputation;
  filer: TaxFilerIdentity | null;
  formStatus: FillPacketResult["formStatus"];
  fetchNotes: string[];
  bindingNotes: string[];
  reconcile: ReconcileResult | null;
  clean: boolean;
  spineForms: string[];
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([612, 792]);
  let y = drawHeader(page, font, bold, {
    title: "Federal + California return packet",
    year: opts.computation.year,
    filer: opts.filer,
    jurisdiction: "combined",
  });

  page.drawText(
    opts.clean
      ? "Prepared for review — not e-filed. Spine reconcile OK. Prefer official blanks."
      : "Prepared for review — not e-filed. SPINE RECONCILE FAILED — not a clean packet.",
    {
      x: 48,
      y,
      size: 10,
      font: bold,
      color: opts.clean ? rgb(0.55, 0.2, 0.1) : rgb(0.7, 0.05, 0.05),
    },
  );
  y -= 18;
  if (opts.reconcile) {
    page.drawText(
      `Spine rules checked: ${opts.reconcile.checked} · failures: ${opts.reconcile.failures.length} · forms: ${opts.spineForms.join(", ")}`,
      { x: 48, y, size: 8, font, color: rgb(0.35, 0.35, 0.4) },
    );
    y -= 16;
  }
  y -= 12;

  const summary = [
    ["Filing status", opts.computation.filingStatus.toUpperCase()],
    ["Resident state", opts.computation.residentState],
    ["Federal total tax", moneyLabel(opts.computation.federal.totalTax.cents)],
    [
      "California total tax",
      moneyLabel(opts.computation.california.totalTax.cents),
    ],
    ["Combined total", moneyLabel(opts.computation.combined.totalTax.cents)],
  ] as const;

  for (const [label, value] of summary) {
    page.drawText(label, { x: 48, y, size: 10, font });
    page.drawText(value, { x: 240, y, size: 10, font: bold });
    y -= 16;
  }

  y -= 10;
  page.drawText("Form blank status", { x: 48, y, size: 11, font: bold });
  y -= 16;
  for (const f of opts.formStatus) {
    if (y < 60) break;
    const tag = f.usedOfficialBlank ? "OFFICIAL" : "GENERATED";
    page.drawText(
      `• [${tag}] ${f.form} (${f.jurisdiction}) — bound ${f.boundLineCount}, unbound ${f.unboundLineCount}`,
      { x: 56, y, size: 8, font },
    );
    y -= 12;
  }

  if (opts.fetchNotes.length) {
    y -= 8;
    page.drawText("Fetch notes", { x: 48, y, size: 11, font: bold });
    y -= 14;
    for (const note of opts.fetchNotes.slice(0, 8)) {
      if (y < 48) break;
      page.drawText(`• ${note.slice(0, 95)}`, {
        x: 56,
        y,
        size: 8,
        font,
        color: rgb(0.35, 0.35, 0.4),
      });
      y -= 11;
    }
  }

  if (opts.computation.limitations.length) {
    y -= 8;
    page.drawText("Open limitations", { x: 48, y, size: 11, font: bold });
    y -= 14;
    for (const note of opts.computation.limitations) {
      if (y < 48) break;
      page.drawText(`• ${note.slice(0, 100)}`, {
        x: 56,
        y,
        size: 8,
        font,
        color: rgb(0.35, 0.35, 0.4),
      });
      y -= 11;
    }
  }

  return doc.save();
}

/** ZIP of per-form PDFs. */
export async function zipReturnPacket(
  files: FilledPacketFile[],
): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.fileName, f.bytes);
  }
  return zip.generateAsync({ type: "uint8array" });
}

/** List blank PDF filenames available for a year (for UI). */
export async function listBlankPdfs(year: number): Promise<string[]> {
  const dir = path.join(taxFormsRoot(), String(year));
  try {
    const names = await readdir(dir);
    return names.filter((n) => n.toLowerCase().endsWith(".pdf"));
  } catch {
    return [];
  }
}

export { listBlankPresence } from "./fetch-forms";
