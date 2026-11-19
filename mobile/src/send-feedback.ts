import type { AppendMessage, ThreadMessageLike } from "@assistant-ui/react-native";

/** Eve `store.send({ message })` payload kept so a failed turn can be resent. */
export type LocalSendOutgoing = string | readonly Record<string, unknown>[];

/** Display-only row while the durable pending marker is being written. */
export type LocalSend = {
  readonly store: object;
  readonly baseline: number;
  readonly eventBaseline: number;
  readonly preview: ThreadMessageLike;
  readonly phase: "preparing" | "uncertain";
  /** Exact payload last passed to `store.send`, for an explicit Resend. */
  readonly outgoing?: LocalSendOutgoing;
};

export function createLocalSend(
  store: object,
  baseline: number,
  eventBaseline: number,
  message: AppendMessage,
  outgoing?: LocalSendOutgoing,
): LocalSend {
  return {
    store,
    baseline,
    eventBaseline,
    phase: "preparing",
    preview: {
      role: "user",
      content: message.content,
      ...(message.attachments?.length ? { attachments: message.attachments } : {}),
    },
    ...(outgoing !== undefined ? { outgoing } : {}),
  };
}

/** Eve resolves send() even when prepareSend failed before network dispatch. */
export function shouldRestoreUnsentDraft(
  error: Error | undefined,
  sendPrepared: boolean,
): boolean {
  return Boolean(error) && !sendPrepared;
}

/**
 * Only delivery.consumed proves eve accepted the turn (stream v27) for an
 * in-flight localSend. Callers that already hold a deliveryId from send()
 * should clear the durable pending marker (and localSend) so the follow-up
 * gate does not treat that marker as still unresolved.
 */
export function hasConfirmedSend(
  events: readonly { readonly type: string }[],
  pending: LocalSend,
): boolean {
  return events
    .slice(pending.eventBaseline)
    .some((event) => event.type === "delivery.consumed");
}

/**
 * Do not replace an unconfirmed turn's recovery state with a later send.
 * When localSend was cleared on deliveryId, pendingMessage must be cleared
 * too — otherwise this still returns true until delivery.consumed.
 */
export function hasUnresolvedSend(
  events: readonly { readonly type: string }[],
  localSend: LocalSend | null,
  pendingMessage: string | null,
): boolean {
  return localSend ? !hasConfirmedSend(events, localSend) : Boolean(pendingMessage);
}

const imageParts = (message: ThreadMessageLike) =>
  (message.attachments ?? []).filter((attachment) =>
    attachment.type === "image" &&
    attachment.content?.some((part) => part.type === "image" && part.image),
  );

// Same stand-in lines as stripFilePlaceholders in message-projection.
const FILE_PLACEHOLDER_LINE = /^\[(?:file(?:: [^\]]*)?|image: [^\]]+)\]$/;

function stripFilePlaceholders(text: string): string {
  return text
    .split("\n")
    .filter((line) => !FILE_PLACEHOLDER_LINE.test(line.trim()))
    .join("\n")
    .trim();
}

function withoutFilePlaceholders(content: ThreadMessageLike["content"]): ThreadMessageLike["content"] {
  const source = typeof content === "string" ? [{ type: "text" as const, text: content }] : content;
  const parts: Exclude<ThreadMessageLike["content"], string>[number][] = [];
  for (const part of source) {
    if (part.type !== "text") {
      parts.push(part);
      continue;
    }
    const text = stripFilePlaceholders(part.text);
    if (text) parts.push({ type: "text", text });
  }
  return parts;
}

/** Keep the composer's photo when eve's row only has a `[file: name]` summary. */
function withPreviewImages(row: ThreadMessageLike, preview: ThreadMessageLike): ThreadMessageLike {
  if (imageParts(row).length > 0 || imageParts(preview).length === 0) return row;
  return {
    ...row,
    content: withoutFilePlaceholders(row.content),
    attachments: [
      ...(row.attachments ?? []).filter((attachment) => attachment.type !== "image"),
      ...imageParts(preview),
    ],
  };
}

/**
 * Display-only snapshot of composer image chips after deliveryId clears
 * localSend, until eve's user row carries a displayable file url.
 */
export type AttachmentHold = {
  readonly baseline: number;
  readonly preview: ThreadMessageLike;
};

export function createAttachmentHold(
  baseline: number,
  message: Pick<AppendMessage, "content" | "attachments">,
): AttachmentHold | null {
  const preview: ThreadMessageLike = {
    role: "user",
    content: message.content,
    ...(message.attachments?.length ? { attachments: message.attachments } : {}),
  };
  if (imageParts(preview).length === 0) return null;
  return { baseline, preview };
}

const displayableImageUrl = (value?: string) =>
  (value && /^https:\/\//i.test(value) ? value : undefined) ??
  (value && /^data:image\/(?:jpeg|jpg|png|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(value)
    ? value
    : undefined);

type EveFilePartLike = {
  readonly type: string;
  readonly mediaType?: string;
  readonly url?: string;
};

type EveMessageLike = {
  readonly role: string;
  readonly parts?: readonly EveFilePartLike[];
};

/** True once the eve user row at/after baseline has a paintable image file. */
export function holdSatisfied(
  eveMessages: readonly EveMessageLike[],
  hold: AttachmentHold,
): boolean {
  const userIndex = eveMessages.findIndex(
    (message, index) => index >= hold.baseline && message.role === "user",
  );
  if (userIndex < 0) return false;
  const parts = eveMessages[userIndex]?.parts ?? [];
  return parts.some(
    (part) =>
      part.type === "file" &&
      typeof part.mediaType === "string" &&
      part.mediaType.startsWith("image/") &&
      Boolean(displayableImageUrl(part.url)),
  );
}

/**
 * Keep composer photos on the bubble after localSend is cleared on deliveryId.
 * Skips holds that still have an active localSend overlay for the same row.
 */
export function applyAttachmentHolds(
  messages: readonly ThreadMessageLike[],
  sourceMessages: readonly { readonly role: string }[],
  holds: readonly AttachmentHold[],
): ThreadMessageLike[] {
  if (holds.length === 0) return messages as ThreadMessageLike[];
  let next: ThreadMessageLike[] | null = null;
  for (const hold of holds) {
    if (imageParts(hold.preview).length === 0) continue;
    const userIndex = sourceMessages.findIndex(
      (message, index) => index >= hold.baseline && message.role === "user",
    );
    if (userIndex < 0) {
      const working = next ?? [...messages];
      working.push(hold.preview);
      next = working;
      continue;
    }
    const row = (next ?? messages)[userIndex];
    if (!row) continue;
    if (imageParts(row).length > 0) continue;
    const merged = withPreviewImages(row, hold.preview);
    if (merged === row) continue;
    const working = next ?? [...messages];
    working[userIndex] = merged;
    next = working;
  }
  return next ?? (messages as ThreadMessageLike[]);
}

/** Hand off at the same positional row when eve publishes its own user message. */
export function projectSendMessages(
  messages: readonly ThreadMessageLike[],
  sourceMessages: readonly { readonly role: string }[],
  pending: LocalSend | null,
  confirmed = false,
): ThreadMessageLike[] {
  // Preserve identity when there is no local overlay so stream ticks that
  // only grow the last assistant can keep a stable messages array reference.
  if (!pending) return messages as ThreadMessageLike[];
  const next = [...messages];
  const userIndex = sourceMessages.findIndex(
    (message, index) => index >= pending.baseline && message.role === "user",
  );
  if (userIndex >= 0 && confirmed) {
    next[userIndex] = withPreviewImages(next[userIndex]!, pending.preview);
    return next;
  }
  // Eve's optimistic user row is the text summary, which drops the photo.
  // Keep the composer preview until that row actually carries the image.
  const index = userIndex >= 0 ? userIndex : next.length;
  const row = pending.preview;
  next[index] = {
    ...row,
    metadata: {
      ...row.metadata,
      custom: {
        ...row.metadata?.custom,
        mobileSendState: pending.phase,
      },
    },
  };
  return next;
}
