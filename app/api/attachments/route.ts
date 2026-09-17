import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

// Attachment uploads: archive the original in Vercel Blob (when the project's
// Blob store is available) and, for PDFs, extract text with
// @firecrawl/pdf-inspector so the model can read the document without
// native PDF support. Media types and size mirror the eve channel's upload
// policy (agent/channels/eve.ts).

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = ["image/*", "text/*", "application/pdf"];
const EXTRACTED_TEXT_LIMIT = 50_000;

function mediaTypeAllowed(mediaType: string) {
  const lower = mediaType.toLowerCase();

  return ALLOWED_MEDIA_TYPES.some((allowed) => {
    if (allowed.endsWith("/*")) {
      return lower.startsWith(allowed.slice(0, -1));
    }

    return lower === allowed;
  });
}

export async function POST(request: Request) {
  const setupStatus = await getSetupStatus();

  if (!setupStatus.appReady || setupStatus.storageMode !== "database") {
    return NextResponse.json(
      { error: "Attachment uploads require database-backed storage." },
      { status: 503 },
    );
  }

  const viewer = await getServerViewer(setupStatus);

  if (!viewer) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  if (!form || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Send multipart/form-data with a `file` field." },
      { status: 400 },
    );
  }

  const mediaType = file.type || "application/octet-stream";

  if (!mediaTypeAllowed(mediaType)) {
    return NextResponse.json(
      {
        error: `Media type ${mediaType} is not allowed. Allowed: ${ALLOWED_MEDIA_TYPES.join(", ")}.`,
      },
      { status: 415 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: `File is ${Math.round(file.size / 1024 / 1024)} MB; the limit is ${Math.round(MAX_BYTES / 1024 / 1024)} MB.`,
      },
      { status: 413 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // Archive the original when the project's Blob store is reachable (it is in
  // Vercel deployments via OIDC). Local dev without a token skips archiving —
  // extraction below is the part the agent actually needs.
  let blobUrl: string | null = null;
  let blobError: string | null = null;

  if (process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const blob = await put(
        `attachments/${viewer.id}/${Date.now()}-${file.name}`,
        bytes,
        {
          // The store is private: user documents must not be publicly
          // accessible. The model never fetches the blob — it reads the
          // extracted text returned below.
          access: "private",
          contentType: mediaType,
          addRandomSuffix: false,
        },
      );
      blobUrl = blob.url;
    } catch (error) {
      blobError =
        error instanceof Error ? error.message : "Blob upload failed.";
    }
  } else {
    blobError = "No Blob store configured in this environment.";
  }

  // PDFs: classify first (routes scanned/image-based documents away), then
  // extract per-page Markdown. Parse failures resolve to a graceful note
  // instead of a 500 — the attachment is still archived when possible.
  let pdfType: string | null = null;
  let pages: number | null = null;
  let extractedText: string | null = null;
  let extractionNote: string | null = null;
  let parsedPages: ReadonlyArray<{ page: number; markdown: string }> | null =
    null;

  if (mediaType === "application/pdf") {
    const { parsePdfAttachment } = await import("@/lib/attachments/pdf");
    const parsed = await parsePdfAttachment(bytes);

    pdfType = parsed.ok ? parsed.pdfType : null;
    pages = parsed.ok ? parsed.pageCount : null;
    parsedPages = parsed.ok ? parsed.pages : null;

    if (parsed.ok) {
      extractedText = parsed.bounded;
    } else {
      extractionNote = parsed.message;
    }
  }

  // Register the attachment so the agent can page through it with
  // read_attachment (PDF text) — keyed to the signed-in user.
  const { saveAgentAttachment } = await import("@/lib/db/queries");
  const attachmentId = await saveAgentAttachment({
    userId: viewer.id,
    name: file.name,
    mediaType,
    byteLength: bytes.byteLength,
    blobUrl,
    pdfType,
    pageCount: pages,
    pages: parsedPages,
    extractionNote,
  });

  return NextResponse.json({
    name: file.name,
    mediaType,
    byteLength: bytes.byteLength,
    attachmentId,
    blobUrl,
    blobError,
    pdfType,
    pages,
    extractedText,
    extractionNote,
  });
}
