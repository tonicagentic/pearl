/**
 * Normalize a browser clipboard event into files + text the composer can use.
 *
 * Screenshots and many copied images only appear on `clipboardData.items`
 * (kind=file), not on `clipboardData.files`. HTML-only and link-only
 * clipboards often have empty `text/plain`.
 */

export type ClipboardPastePayload = {
  readonly files: readonly File[];
  readonly text: string;
};

const IMAGE_MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function extensionForMime(mime: string): string {
  if (IMAGE_MIME_EXT[mime]) return IMAGE_MIME_EXT[mime];
  if (mime === "application/pdf") return "pdf";
  if (mime === "text/plain") return "txt";
  if (mime === "text/markdown") return "md";
  if (mime === "text/csv" || mime === "application/csv") return "csv";
  if (mime === "application/json" || mime === "text/json") return "json";
  const slash = mime.indexOf("/");
  if (slash > 0) {
    const subtype = mime.slice(slash + 1).split("+")[0]?.split(";")[0];
    if (subtype && /^[a-z0-9.-]+$/i.test(subtype)) return subtype;
  }
  return "bin";
}

function isUnnamedClipboardFile(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;
  if (trimmed === "blob") return true;
  // Browsers often label every screenshot paste with this generic name.
  if (/^image\.(png|jpe?g|webp|gif)$/i.test(trimmed)) return true;
  return false;
}

/** Give unnamed clipboard blobs a stable filename the adapters can accept. */
export function nameClipboardFile(file: File, index: number): File {
  if (!isUnnamedClipboardFile(file.name)) return file;

  const mime = (file.type || "application/octet-stream").toLowerCase();
  const ext = extensionForMime(mime);
  const base = mime.startsWith("image/")
    ? "pasted-image"
    : mime === "application/pdf"
      ? "pasted-document"
      : "pasted-file";
  const suffix = index > 0 ? `-${index + 1}` : "";
  return new File([file], `${base}${suffix}.${ext}`, {
    type: file.type || mime,
    lastModified: file.lastModified,
  });
}

/** Strip tags / entities from HTML clipboard payloads to plain text. */
export function htmlClipboardToText(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return "";

  // Prefer DOM parsing in the browser; fall back for unit tests / Node.
  if (typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(trimmed, "text/html");
      const text = doc.body?.textContent ?? "";
      return text.replace(/\u00a0/g, " ").replace(/\r\n/g, "\n").trim();
    } catch {
      // fall through
    }
  }

  return trimmed
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r\n/g, "\n")
    .trim();
}

function collectFiles(data: DataTransfer | null): File[] {
  if (!data) return [];

  const seen = new Set<string>();
  const files: File[] = [];

  const push = (file: File | null | undefined) => {
    if (!file) return;
    // Deduplicate when the same blob appears on both files and items.
    const key = `${file.name}|${file.type}|${file.size}|${file.lastModified}`;
    if (seen.has(key)) return;
    seen.add(key);
    files.push(file);
  };

  if (data.files?.length) {
    for (const file of Array.from(data.files)) {
      push(file);
    }
  }

  if (data.items?.length) {
    for (const item of Array.from(data.items)) {
      if (item.kind !== "file") continue;
      push(item.getAsFile());
    }
  }

  return files.map((file, index) => nameClipboardFile(file, index));
}

function collectText(data: DataTransfer | null): string {
  if (!data) return "";

  const plain = data.getData("text/plain")?.replace(/\r\n/g, "\n") ?? "";
  if (plain.trim().length > 0) return plain;

  const html = data.getData("text/html") ?? "";
  const fromHtml = htmlClipboardToText(html);
  if (fromHtml.length > 0) return fromHtml;

  const uriList = data.getData("text/uri-list") ?? "";
  const urls = uriList
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  if (urls.length > 0) return urls.join("\n");

  return "";
}

/**
 * Read files and text from a paste event's clipboardData.
 * Pure relative to the DataTransfer — safe to unit test with a stub.
 */
export function readClipboardPaste(
  data: DataTransfer | null | undefined,
): ClipboardPastePayload {
  const transfer = data ?? null;
  return {
    files: collectFiles(transfer),
    text: collectText(transfer),
  };
}

/** True when the composer handler must own the paste (files and/or long text). */
export function composerMustHandlePaste(
  payload: ClipboardPastePayload,
  largePasteChars: number,
): boolean {
  if (payload.files.length > 0) return true;
  return payload.text.length >= largePasteChars;
}

/** Normalize pasted clipboard text (plain, stripped HTML, or URL). */
export function normalizeClipboardText(args: {
  readonly text?: string | null;
  readonly html?: string | null;
  readonly url?: string | null;
}): string {
  const plain = args.text?.replace(/\r\n/g, "\n").trim() ?? "";
  if (plain.length > 0) return plain;

  const fromHtml = htmlClipboardToText(args.html ?? "");
  if (fromHtml.length > 0) return fromHtml;

  const url = args.url?.trim() ?? "";
  return url;
}
