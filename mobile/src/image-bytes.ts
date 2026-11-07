/** Decode a `data:image/...;base64,...` URI into raw bytes for multipart upload. */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/i.exec(dataUrl);
  if (!match) {
    throw new Error("Photo data is not a valid data URL.");
  }
  const isBase64 = Boolean(match[2]);
  const payload = match[3] ?? "";
  if (!isBase64) {
    throw new Error("Photo data must be base64-encoded.");
  }
  const cleaned = payload.replace(/[\t\n\f\r ]/g, "");
  // atob is available in Hermes / RN; Buffer is not.
  const binary = globalThis.atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
