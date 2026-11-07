import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { sessionInvalid } from "./session-store";

export { dataUrlToBytes } from "./image-bytes";

/** Successful `/api/attachments` image fields used to build the eve FilePart. */
export type ImageUploadResponse = {
  attachmentId?: string;
  blobUrl?: string | null;
  blobError?: string | null;
  mediaType?: string;
  error?: string;
};

// Keep under the platform multipart ceiling and the model inline guideline.
const MAX_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024;

/**
 * Upload a JPEG for vision. Returns a public Blob URL the model can fetch.
 * Call before the eve turn so the session payload stays small on mobile.
 */
export async function uploadImageAttachment(input: {
  readonly bytes: Uint8Array;
  readonly name: string;
  readonly mediaType?: string;
}): Promise<string> {
  if (input.bytes.byteLength === 0) {
    throw new Error("The photo is empty.");
  }
  if (input.bytes.byteLength > MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error("Photo is too large after resizing (2 MB limit).");
  }

  const credential = getAuthCookie();
  if (!credential) {
    throw new Error("Sign in before attaching a photo.");
  }

  const mediaType = input.mediaType ?? "image/jpeg";
  const form = new FormData();
  form.append("file", {
    name: input.name,
    type: mediaType,
    bytes: async () => input.bytes,
  } as unknown as Blob);

  const response = await fetch(`${AGENT_URL}/api/attachments`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${credential}`,
      cookie: `better-auth.session_token=${encodeURIComponent(credential)}`,
    },
    body: form,
  });
  const data = (await response.json().catch(() => null)) as ImageUploadResponse | null;

  if (response.status === 401) {
    sessionInvalid();
  }
  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : `Photo upload failed (${response.status}).`,
    );
  }
  const blobUrl = data?.blobUrl?.trim();
  if (!blobUrl || !/^https:\/\//i.test(blobUrl)) {
    throw new Error(
      data?.blobError?.trim() ||
        "Photo upload did not return a public URL. Check Blob storage.",
    );
  }
  return blobUrl;
}
