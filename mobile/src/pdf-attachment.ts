import { File } from "expo-file-system";

import { AGENT_URL, getAuthCookie } from "./eve-transport";
import {
  formatPdfAttachmentSummary,
  type PdfUploadResponse,
} from "./pdf-attachment-summary";
import { sessionInvalid } from "./session-store";

export { formatPdfAttachmentSummary } from "./pdf-attachment-summary";
export type { PdfUploadResponse } from "./pdf-attachment-summary";

// The deployed function receives the multipart body before its 10 MB policy
// runs; keep mobile uploads below the platform's smaller request-body ceiling.
const MAX_PDF_BYTES = 3 * 1024 * 1024;

/** The native fields of Expo SDK 57's DocumentPickerAsset used by this helper. */
export type PdfDocumentPickerAsset = {
  readonly uri: string;
  readonly name: string;
  readonly mimeType?: string;
  readonly size?: number;
};

/**
 * Upload a picked PDF and return text to include in the outgoing user message.
 * The parent should await this before sending; on failure, keep the composer
 * draft and show the thrown error instead of reporting an attachment as sent.
 * Pick with type: 'application/pdf' (and copyToCacheDirectory: true on native).
 * This does not render the server's private blobUrl or send the PDF as a model file.
 */
export async function uploadPdfAttachment(
  asset: PdfDocumentPickerAsset,
): Promise<string> {
  const looksLikePdf =
    /\.pdf$/i.test(asset.name) ||
    asset.mimeType?.toLowerCase() === "application/pdf";
  if (!asset.uri || !asset.name || !looksLikePdf) {
    throw new Error("Select a PDF to attach.");
  }
  if (asset.size !== undefined && asset.size > MAX_PDF_BYTES) {
    throw new Error("PDF attachments must be 3 MB or smaller.");
  }

  const credential = getAuthCookie();
  if (!credential) {
    throw new Error("Sign in before attaching a PDF.");
  }

  const file = new File(asset.uri);
  if (!file.exists) {
    throw new Error("Could not read the selected PDF.");
  }
  if (file.size > MAX_PDF_BYTES) {
    throw new Error("PDF attachments must be 3 MB or smaller.");
  }

  // Read bytes up front. expo/fetch's multipart encoder needs a part with
  // bytes(); relying on File.bytes() alone has been flaky across SDK builds,
  // while arrayBuffer() is the stable Blob surface.
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error("The selected PDF is empty.");
  }
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new Error("PDF attachments must be 3 MB or smaller.");
  }

  const form = new FormData();
  form.append("file", {
    name: asset.name,
    type: "application/pdf",
    bytes: async () => bytes,
  } as unknown as Blob);

  const response = await fetch(`${AGENT_URL}/api/attachments`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${credential}`,
      // better-auth also accepts the session token as a cookie; send both so
      // attachment uploads work the same way as other mobile API clients.
      cookie: `better-auth.session_token=${encodeURIComponent(credential)}`,
    },
    body: form, // Let fetch set multipart/form-data with its boundary.
  });
  const data = (await response.json().catch(() => null)) as PdfUploadResponse | null;

  if (response.status === 401) {
    sessionInvalid();
  }
  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : `PDF upload failed (${response.status}).`,
    );
  }
  if (!data) {
    throw new Error("PDF upload returned an empty response.");
  }

  return formatPdfAttachmentSummary(asset.name, data);
}
