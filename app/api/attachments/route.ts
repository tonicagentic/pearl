import { NextResponse } from "next/server";
import { issueSignedToken, presignUrl, put } from "@vercel/blob";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

// Attachment uploads: archive the original in Vercel Blob (when the project's
// Blob store is available) and, for PDFs, extract text with
// @firecrawl/pdf-inspector so the model can read the document without
// native PDF support. Media types and size mirror the eve channel's upload
// policy (agent/channels/eve.ts).
//
// The project Blob store is private. Images still need a fetchable HTTPS URL
// for vision FileParts, so we return a time-limited signed GET URL to clients
// while archiving the canonical private URL in the DB.

const MAX_BYTES = 10 * 1024 * 1024;
/** Signed image URLs stay fetchable long enough for a turn (and retries). */
const IMAGE_SIGNED_URL_TTL_MS = 24 * 60 * 60 * 1000;
const ALLOWED_MEDIA_TYPES = [
  "image/*",
  "text/*",
  "application/pdf",
  "application/json",
  "application/csv",
];
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

async function signedImageGetUrl(pathname: string): Promise<string> {
  const validUntil = Date.now() + IMAGE_SIGNED_URL_TTL_MS;
  const token = await issueSignedToken({
    pathname,
    operations: ["get"],
    validUntil,
  });
  const { presignedUrl } = await presignUrl(token, {
    operation: "get",
    pathname,
    access: "private",
    validUntil,
  });
  return presignedUrl;
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
  let clientBlobUrl: string | null = null;
  let blobError: string | null = null;
  const isImage = mediaType.toLowerCase().startsWith("image/");

  if (process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      // Always private — the connected store rejects public puts.
      // Images: mint a signed GET URL so the model/gateway can fetch them
      // (mobile sends that URL instead of a multi-MB data URL).
      // PDFs/text: agent uses extracted text / read_attachment.
      const blob = await put(
        `attachments/${viewer.id}/${Date.now()}-${file.name}`,
        bytes,
        {
          access: "private",
          contentType: mediaType,
          addRandomSuffix: false,
        },
      );
      blobUrl = blob.url;
      clientBlobUrl = isImage
        ? await signedImageGetUrl(blob.pathname)
        : blob.url;
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
    // Clients get a signed URL for images; DB keeps the canonical private URL.
    blobUrl: clientBlobUrl ?? blobUrl,
    blobError,
    pdfType,
    pages,
    extractedText,
    extractionNote,
  });
}
