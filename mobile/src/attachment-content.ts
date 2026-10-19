import type { AppendMessage } from "@assistant-ui/react-native";

const ATTACHMENT_MARKER_PREFIX = "[mobile-attachment:";

/** A per-turn, non-secret marker for reconciling an attachment-only receive. */
export function createAttachmentMarker(): string {
  return `${ATTACHMENT_MARKER_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}]`;
}

export function isAttachmentMarker(text: string): boolean {
  return text.startsWith(ATTACHMENT_MARKER_PREFIX);
}

/** Convert one composer submission to eve's UserContent; never send a decorative chip alone. */
export function toEveTurn(message: Pick<AppendMessage, "content" | "attachments">) {
  const text = message.content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n");
  const files: { type: "file"; data: string; mediaType: string; filename: string }[] = [];
  const extraText: { type: "text"; text: string }[] = [];

  for (const attachment of message.attachments ?? []) {
    if (attachment.status.type !== "complete") {
      throw new Error(`Attachment ${attachment.name} is not ready.`);
    }
    for (const part of attachment.content) {
      if (part.type === "image") {
        files.push({
          type: "file",
          data: part.image,
          mediaType: attachment.contentType ?? "image/jpeg",
          filename: attachment.name,
        });
      } else if (part.type === "file") {
        files.push({
          type: "file",
          data: part.data,
          mediaType: part.mimeType,
          filename: part.filename ?? attachment.name,
        });
      } else if (part.type === "text") {
        extraText.push({ type: "text", text: part.text });
      }
    }
  }

  // Images travel inline as base64 in the eve request. Bound the aggregate
  // JSON body, not only individual photos, before clearing the draft.
  if (files.reduce((total, file) => total + file.data.length, 0) > 2_800_000) {
    throw new Error("Photos are too large together. Remove one and try again.");
  }
  if (files.length === 0 && extraText.length === 0) {
    if ((message.attachments?.length ?? 0) > 0) throw new Error("Attachment has no content.");
    return { text, message: text };
  }
  const parts: ({ type: "text"; text: string } | (typeof files)[number])[] = [];
  if (text.trim()) parts.push({ type: "text", text });
  parts.push(...extraText, ...files);
  return { text, message: parts };
}
