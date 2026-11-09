import { File } from "expo-file-system";

import { AGENT_URL, getAuthCookie } from "./eve-transport";
import {
  isSupportedAttachment,
  normalizeAttachmentMediaType,
} from "./file-attachment-meta";
import { sessionInvalid } from "./session-store";

export {
  isSupportedAttachment,
  normalizeAttachmentMediaType,
} from "./file-attachment-meta";

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_INLINE_TEXT_BYTES = 50_000;

export type FileUploadResponse = {
  attachmentId?: string;
  blobUrl?: string | null;
  blobError?: string | null;
  mediaType?: string;
  extractedText?: string | null;
  error?: string;
};

/**
 * Upload a non-image document to /api/attachments. Returns a composer text
 * summary the agent can read; PDF extraction is handled server-side.
 */
export async function uploadFileAttachment(input: {
  readonly uri: string;
  readonly name: string;
  readonly mimeType?: string;
  readonly size?: number;
}): Promise<{ summary: string; mediaType: string; blobUrl: string | null }> {
  if (!isSupportedAttachment(input.name, input.mimeType)) {
    throw new Error("Choose a PDF, CSV, text, Markdown, or JSON file.");
  }

  const mediaType = normalizeAttachmentMediaType(input.name, input.mimeType);
  if (input.size !== undefined && input.size > MAX_FILE_BYTES) {
    throw new Error("Files must be 3 MB or smaller.");
  }

  const credential = getAuthCookie();
  if (!credential) {
    throw new Error("Sign in before attaching a file.");
  }

  const file = new File(input.uri);
  if (!file.exists) {
    throw new Error("Could not read the selected file.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Files must be 3 MB or smaller.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error("The selected file is empty.");
  }

  // Small text files: include the body inline so the model sees it immediately.
  if (mediaType.startsWith("text/") || mediaType === "application/json") {
    if (bytes.byteLength <= MAX_INLINE_TEXT_BYTES) {
      const text = new TextDecoder().decode(bytes);
      // Still archive when possible so read_attachment can fetch later.
      let blobUrl: string | null = null;
      try {
        blobUrl = await postAttachmentBytes({
          bytes,
          name: input.name,
          mediaType,
          credential,
        });
      } catch {
        blobUrl = null;
      }
      const header = blobUrl
        ? `[Attached text file: ${input.name} — ${blobUrl}]`
        : `[Attached text file: ${input.name}]`;
      return {
        summary: `${header}\n${text}`,
        mediaType,
        blobUrl,
      };
    }
  }

  const blobUrl = await postAttachmentBytes({
    bytes,
    name: input.name,
    mediaType,
    credential,
  });

  if (mediaType === "application/pdf") {
    // Prefer the PDF helper's richer summary when callers use uploadPdfAttachment;
    // this generic path still archives + returns a readable marker.
    return {
      summary: `[Attached PDF: ${input.name}${blobUrl ? ` — ${blobUrl}` : ""}]`,
      mediaType,
      blobUrl,
    };
  }

  return {
    summary: `[Attached file: ${input.name}${blobUrl ? ` — ${blobUrl}` : ""}]`,
    mediaType,
    blobUrl,
  };
}

async function postAttachmentBytes(input: {
  readonly bytes: Uint8Array;
  readonly name: string;
  readonly mediaType: string;
  readonly credential: string;
}): Promise<string | null> {
  const form = new FormData();
  form.append("file", {
    name: input.name,
    type: input.mediaType,
    bytes: async () => input.bytes,
  } as unknown as Blob);

  const response = await fetch(`${AGENT_URL}/api/attachments`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.credential}`,
      cookie: `better-auth.session_token=${encodeURIComponent(input.credential)}`,
    },
    body: form,
  });

  const data = (await response.json().catch(() => null)) as FileUploadResponse | null;

  if (response.status === 401) {
    sessionInvalid();
  }
  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : `File upload failed (${response.status}).`,
    );
  }

  const blobUrl = data?.blobUrl?.trim() || null;
  if (data?.extractedText?.trim()) {
    // Caller may prefer extracted text; blob URL is still returned.
  }
  return blobUrl && /^https:\/\//i.test(blobUrl) ? blobUrl : null;
}
