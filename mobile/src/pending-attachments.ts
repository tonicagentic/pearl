/**
 * Chat-scoped pending composer attachments. Survives adapter/input remounts
 * within the same chat; cleared only on remove, successful send, or new chat.
 */

export type PendingAttachmentDraft = {
  readonly name: string;
  readonly contentType: string;
  readonly type: "image" | "document";
  readonly content: (
    | { type: "image"; image: string }
    | { type: "text"; text: string }
    | { type: "file"; data: string; mimeType: string; filename?: string }
  )[];
};

const byChat = new Map<string, PendingAttachmentDraft[]>();

/** Stable key for the untitled draft chat. */
export const PENDING_ATTACHMENTS_DRAFT_KEY = "draft";

export function chatAttachmentKey(chatId: string | null | undefined): string {
  return chatId ?? PENDING_ATTACHMENTS_DRAFT_KEY;
}

export function getPendingAttachments(
  chatKey: string,
): readonly PendingAttachmentDraft[] {
  return byChat.get(chatKey) ?? [];
}

export function setPendingAttachments(
  chatKey: string,
  attachments: readonly PendingAttachmentDraft[],
): void {
  if (attachments.length === 0) {
    byChat.delete(chatKey);
    return;
  }
  byChat.set(chatKey, [...attachments]);
}

export function clearPendingAttachments(chatKey: string): void {
  byChat.delete(chatKey);
}

export function appendPendingAttachment(
  chatKey: string,
  attachment: PendingAttachmentDraft,
): void {
  const current = byChat.get(chatKey) ?? [];
  byChat.set(chatKey, [...current, attachment]);
}

export function removePendingAttachment(
  chatKey: string,
  name: string,
  contentType: string,
): void {
  const current = byChat.get(chatKey) ?? [];
  const next = current.filter(
    (item) => !(item.name === name && item.contentType === contentType),
  );
  setPendingAttachments(chatKey, next);
}
