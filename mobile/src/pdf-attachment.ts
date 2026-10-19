import { File } from 'expo-file-system';
import { AGENT_URL, getAuthCookie } from './eve-transport';
import { sessionInvalid } from './session-store';

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

type UploadResponse = {
  attachmentId?: string;
  pages?: number | null;
  extractedText?: string | null;
  extractionNote?: string | null;
  error?: string;
};

/**
 * Upload a picked PDF and return text to include in the outgoing user message.
 * The parent should await this before sending; on failure, keep the composer
 * draft and show the thrown error instead of reporting an attachment as sent.
 * Pick with type: 'application/pdf' (and copyToCacheDirectory: true on native).
 * This does not render the server's private blobUrl or send the PDF as a model file.
 */
export async function uploadPdfAttachment(asset: PdfDocumentPickerAsset): Promise<string> {
  if (!asset.uri || !asset.name || (asset.mimeType && asset.mimeType.toLowerCase() !== 'application/pdf')) {
    throw new Error('Select a PDF to attach.');
  }
  if (asset.size !== undefined && asset.size > MAX_PDF_BYTES) {
    throw new Error('PDF attachments must be 3 MB or smaller.');
  }

  const credential = getAuthCookie();
  if (!credential) {
    throw new Error('Sign in before attaching a PDF.');
  }

  const file = new File(asset.uri);
  if (file.size > MAX_PDF_BYTES) throw new Error('PDF attachments must be 3 MB or smaller.');
  const form = new FormData();
  // index.ts installs expo/fetch, whose multipart encoder needs bytes(), not
  // React Native's { uri, name, type } convention. Keep the original name.
  form.append('file', {
    name: asset.name,
    type: 'application/pdf',
    bytes: () => file.bytes(),
  } as unknown as Blob);

  const response = await fetch(`${AGENT_URL}/api/attachments`, {
    method: 'POST',
    headers: { authorization: `Bearer ${credential}` },
    body: form, // Let fetch set multipart/form-data with its boundary.
  });
  const data = (await response.json().catch(() => null)) as UploadResponse | null;

  if (response.status === 401) {
    sessionInvalid();
  }
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : `PDF upload failed (${response.status}).`);
  }
  if (!data || typeof data.attachmentId !== 'string' || !data.attachmentId) {
    throw new Error('PDF upload returned no attachment ID.');
  }
  if (data.extractionNote) {
    throw new Error(`PDF text could not be extracted: ${data.extractionNote}`);
  }
  if (typeof data.extractedText !== 'string' || !data.extractedText) {
    throw new Error('PDF upload returned no extracted text.');
  }

  const firstPageMatch = data.extractedText.match(/\[page 1\]\n([\s\S]*?)(?:\n\n\[page 2\]|$)/);
  if (!firstPageMatch) {
    throw new Error('PDF upload returned no page 1 text.');
  }
  const firstPage = firstPageMatch[1].trim().slice(0, 8_000);
  return `[Attached PDF: ${asset.name} — ${data.pages ?? '?'} pages, stored as attachment ${data.attachmentId}. Read any page with read_attachment({ attachmentId: "${data.attachmentId}", page: N }). Page 1:\n\n${firstPage}]`;
}
