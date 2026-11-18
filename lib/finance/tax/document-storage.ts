import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { put, get } from "@vercel/blob";

const LOCAL_ROOT = path.join(process.cwd(), "data", "tax-documents");

export function blobConfigured() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN?.trim() ||
      process.env.BLOB_STORE_ID?.trim(),
  );
}

function localPathFromUrl(blobUrl: string) {
  if (!blobUrl.startsWith("local:")) {
    throw new Error("Not a local tax document URL");
  }
  const rel = blobUrl.slice("local:".length);
  const full = path.resolve(LOCAL_ROOT, rel);
  if (!full.startsWith(path.resolve(LOCAL_ROOT))) {
    throw new Error("Invalid local tax document path");
  }
  return full;
}

/** Store a tax document file; returns a URL (Blob or local: relative). */
export async function storeTaxDocumentFile(opts: {
  year: number;
  documentId: string;
  fileName: string;
  contentType: string;
  bytes: Buffer;
}): Promise<{ blobUrl: string }> {
  const safeName = opts.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const pathname = `tax-documents/${opts.year}/${opts.documentId}-${safeName}`;

  if (blobConfigured()) {
    const result = await put(pathname, opts.bytes, {
      access: "private",
      contentType: opts.contentType,
      addRandomSuffix: false,
    });
    return { blobUrl: result.url };
  }

  const full = path.join(LOCAL_ROOT, String(opts.year), `${opts.documentId}-${safeName}`);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, opts.bytes);
  return {
    blobUrl: `local:${opts.year}/${opts.documentId}-${safeName}`,
  };
}

export async function readTaxDocumentBytes(blobUrl: string): Promise<Buffer> {
  if (blobUrl.startsWith("local:")) {
    return readFile(localPathFromUrl(blobUrl));
  }

  if (!blobConfigured()) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is required to read private tax documents",
    );
  }

  const result = await get(blobUrl, { access: "private" });
  if (result?.statusCode === 200 && result.stream) {
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c)));
  }

  throw new Error(
    `Failed to read private tax document (${result?.statusCode ?? "unknown"})`,
  );
}
