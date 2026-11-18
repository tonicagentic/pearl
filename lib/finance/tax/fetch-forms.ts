import {
  mkdir,
  readFile,
  writeFile,
  access,
  readdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import {
  FORM_CATALOG,
  INSTRUCTION_CATALOG,
  blankDir,
  blankFilePath,
  catalogEntryForForm,
  instructionDir,
  instructionFilePath,
  pdfMatchesTaxYear,
  resolveCatalogUrl,
  resolveInstructionUrls,
  type CatalogForm,
  type CatalogInstruction,
} from "./form-catalog";

export type FetchFormStatus = {
  form: string;
  fileName: string;
  status: "downloaded" | "cached" | "skipped" | "failed";
  url?: string;
  error?: string;
  bytes?: number;
  /** Form year detected inside the PDF, when known */
  detectedYear?: number | null;
};

export type BlankPresence = {
  form: string;
  fileName: string;
  present: boolean;
  path: string;
  fetchable: boolean;
};

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function downloadUrl(url: string): Promise<{
  ok: boolean;
  bytes?: Buffer;
  status?: number;
  etag?: string | null;
  lastModified?: string | null;
  error?: string;
}> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "financial-health-tax-forms/1.0 (personal; local cache)",
        Accept: "application/pdf,*/*",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 1000 || buf.subarray(0, 4).toString() !== "%PDF") {
      return {
        ok: false,
        status: res.status,
        error: "Response was not a PDF",
      };
    }
    return {
      ok: true,
      bytes: buf,
      status: res.status,
      etag: res.headers.get("etag"),
      lastModified: res.headers.get("last-modified"),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Fetch failed",
    };
  }
}

export async function listBlankPresence(year: number): Promise<BlankPresence[]> {
  return Promise.all(
    FORM_CATALOG.map(async (entry) => {
      const p = blankFilePath(year, entry);
      return {
        form: entry.form,
        fileName: entry.fileName,
        present: await exists(p),
        path: p,
        fetchable: Boolean(entry.url || entry.fallbackUrls?.length),
      };
    }),
  );
}

type BlankMeta = {
  form?: string;
  url?: string;
  taxYear?: number;
  detectedYear?: number | null;
  etag?: string | null;
  lastModified?: string | null;
  fetchedAt?: string;
  bytes?: number;
};

async function readBlankMeta(metaPath: string): Promise<BlankMeta | null> {
  try {
    return JSON.parse(await readFile(metaPath, "utf8")) as BlankMeta;
  } catch {
    return null;
  }
}

async function cachedBlankMatchesYear(
  dest: string,
  metaPath: string,
  year: number,
): Promise<{ ok: boolean; detected: number | null; bytes?: number }> {
  if (!(await exists(dest))) return { ok: false, detected: null };
  const bytes = await readFile(dest);
  const meta = await readBlankMeta(metaPath);
  if (meta?.taxYear === year) {
    const detected = meta.detectedYear ?? pdfMatchesTaxYear(bytes, year).detected;
    if (detected == null || detected === year) {
      return { ok: true, detected, bytes: bytes.byteLength };
    }
  }
  const match = pdfMatchesTaxYear(bytes, year);
  return {
    ok: match.ok,
    detected: match.detected,
    bytes: bytes.byteLength,
  };
}

/** Download official blanks for a tax year into tax-forms/{year}/. */
export async function fetchTaxFormBlanks(
  year: number,
  opts?: { forms?: string[]; force?: boolean },
): Promise<FetchFormStatus[]> {
  const wanted = opts?.forms?.length
    ? FORM_CATALOG.filter((e) => opts.forms!.includes(e.form))
    : FORM_CATALOG.filter((e) => e.url || (e.fallbackUrls?.length ?? 0) > 0);

  await mkdir(blankDir(year), { recursive: true });
  const results: FetchFormStatus[] = [];

  for (const entry of wanted) {
    const dest = blankFilePath(year, entry);
    const metaPath = `${dest}.meta.json`;

    if (!opts?.force && (await exists(dest))) {
      const cached = await cachedBlankMatchesYear(dest, metaPath, year);
      if (cached.ok) {
        results.push({
          form: entry.form,
          fileName: entry.fileName,
          status: "cached",
          bytes: cached.bytes,
          detectedYear: cached.detected,
        });
        continue;
      }
      // Wrong-year blank in the year folder — remove and re-download.
      await unlink(dest).catch(() => undefined);
      await unlink(metaPath).catch(() => undefined);
    }

    const urls = resolveCatalogUrl(entry, year);
    if (urls.length === 0) {
      results.push({
        form: entry.form,
        fileName: entry.fileName,
        status: "skipped",
        error: "No official download URL (use generated page)",
      });
      continue;
    }

    let downloaded: FetchFormStatus | null = null;
    for (const url of urls) {
      const got = await downloadUrl(url);
      if (!got.ok || !got.bytes) {
        downloaded = {
          form: entry.form,
          fileName: entry.fileName,
          status: "failed",
          url,
          error: got.error,
        };
        continue;
      }
      const match = pdfMatchesTaxYear(got.bytes, year);
      if (!match.ok) {
        downloaded = {
          form: entry.form,
          fileName: entry.fileName,
          status: "failed",
          url,
          detectedYear: match.detected,
          error: `PDF year mismatch: wanted ${year}, detected ${match.detected}`,
        };
        continue;
      }
      await writeFile(dest, got.bytes);
      await writeFile(
        metaPath,
        JSON.stringify(
          {
            form: entry.form,
            url,
            taxYear: year,
            detectedYear: match.detected,
            etag: got.etag,
            lastModified: got.lastModified,
            fetchedAt: new Date().toISOString(),
            bytes: got.bytes.byteLength,
          } satisfies BlankMeta,
          null,
          2,
        ),
      );
      downloaded = {
        form: entry.form,
        fileName: entry.fileName,
        status: "downloaded",
        url,
        bytes: got.bytes.byteLength,
        detectedYear: match.detected,
      };
      break;
    }

    if (!downloaded || downloaded.status !== "downloaded") {
      // Ensure a failed fetch does not leave a wrong-year file behind.
      if (await exists(dest)) {
        const leftover = await cachedBlankMatchesYear(dest, metaPath, year);
        if (!leftover.ok) {
          await unlink(dest).catch(() => undefined);
          await unlink(metaPath).catch(() => undefined);
        }
      }
    }

    results.push(
      downloaded ?? {
        form: entry.form,
        fileName: entry.fileName,
        status: "failed",
        error: "All candidate URLs failed",
      },
    );
  }

  return results;
}

/** Ensure blanks exist for the given workpaper form names (fetch missing / wrong-year). */
export async function ensureBlanksForForms(
  year: number,
  forms: string[],
): Promise<FetchFormStatus[]> {
  const needFetch: string[] = [];
  const cached: FetchFormStatus[] = [];

  for (const form of forms) {
    const entry = catalogEntryForForm(form);
    if (!entry) continue;
    if (!(entry.url || entry.fallbackUrls?.length)) continue;
    const dest = blankFilePath(year, entry);
    const metaPath = `${dest}.meta.json`;
    if (await exists(dest)) {
      const match = await cachedBlankMatchesYear(dest, metaPath, year);
      if (match.ok) {
        cached.push({
          form,
          fileName: entry.fileName,
          status: "cached",
          bytes: match.bytes,
          detectedYear: match.detected,
        });
        continue;
      }
    }
    needFetch.push(form);
  }

  if (needFetch.length === 0) return cached;
  const fetched = await fetchTaxFormBlanks(year, { forms: needFetch });
  return [...cached, ...fetched];
}

export async function inventoryPdfFields(
  pdfPath: string,
): Promise<{ name: string; type: string }[]> {
  const { PDFDocument } = await import("pdf-lib");
  const bytes = await readFile(pdfPath);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();
  return form.getFields().map((f) => ({
    name: f.getName(),
    type: f.constructor.name,
  }));
}

export async function writeFieldInventories(year: number) {
  const dir = blankDir(year);
  const fieldsDir = path.join(dir, "fields");
  await mkdir(fieldsDir, { recursive: true });
  const names = await readdir(dir);
  const written: string[] = [];
  for (const name of names) {
    if (!name.toLowerCase().endsWith(".pdf")) continue;
    const pdfPath = path.join(dir, name);
    const fields = await inventoryPdfFields(pdfPath);
    const out = path.join(fieldsDir, name.replace(/\.pdf$/i, ".json"));
    await writeFile(out, JSON.stringify(fields, null, 2));
    written.push(out);
  }
  return written;
}

export function catalogForms(): CatalogForm[] {
  return FORM_CATALOG;
}

/** Download IRS instruction PDFs into tax-forms/{year}/instructions/. */
export async function fetchTaxInstructions(
  year: number,
  opts?: { force?: boolean; forms?: string[] },
): Promise<FetchFormStatus[]> {
  const wanted = opts?.forms?.length
    ? INSTRUCTION_CATALOG.filter((e) => opts.forms!.includes(e.form))
    : INSTRUCTION_CATALOG;

  await mkdir(instructionDir(year), { recursive: true });
  const results: FetchFormStatus[] = [];

  for (const entry of wanted) {
    const dest = instructionFilePath(year, entry);
    if (!opts?.force && (await exists(dest))) {
      const st = await readFile(dest);
      const match = pdfMatchesTaxYear(st, year);
      if (match.ok) {
        results.push({
          form: entry.form,
          fileName: entry.fileName,
          status: "cached",
          bytes: st.byteLength,
          detectedYear: match.detected,
        });
        continue;
      }
    }

    const urls = resolveInstructionUrls(entry, year);

    let downloaded: FetchFormStatus | null = null;
    for (const url of urls) {
      const got = await downloadUrl(url);
      if (!got.ok || !got.bytes) {
        downloaded = {
          form: entry.form,
          fileName: entry.fileName,
          status: "failed",
          url,
          error: got.error,
        };
        continue;
      }
      const match = pdfMatchesTaxYear(got.bytes, year);
      if (!match.ok) {
        downloaded = {
          form: entry.form,
          fileName: entry.fileName,
          status: "failed",
          url,
          detectedYear: match.detected,
          error: `PDF year mismatch: wanted ${year}, detected ${match.detected}`,
        };
        continue;
      }
      await writeFile(dest, got.bytes);
      downloaded = {
        form: entry.form,
        fileName: entry.fileName,
        status: "downloaded",
        url,
        bytes: got.bytes.byteLength,
        detectedYear: match.detected,
      };
      break;
    }

    results.push(
      downloaded ?? {
        form: entry.form,
        fileName: entry.fileName,
        status: "failed",
        error: "All candidate URLs failed",
      },
    );
  }

  return results;
}

export function catalogInstructions(): CatalogInstruction[] {
  return INSTRUCTION_CATALOG;
}
