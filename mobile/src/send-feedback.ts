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
 * Only delivery.consumed proves eve accepted the turn (stream v27). An
 * optimistic row or a resolved Delivery from send() also counts when the
 * caller already holds a deliveryId.
 */
export function hasConfirmedSend(
  events: readonly { readonly type: string }[],
  pending: LocalSend,
): boolean {
  return events
    .slice(pending.eventBaseline)
    .some((event) => event.type === "delivery.consumed");
}

/** Do not replace an unconfirmed turn's recovery state with a later send. */
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

/** Hand off at the same positional row when eve publishes its own user message. */
export function projectSendMessages(
  messages: readonly ThreadMessageLike[],
  sourceMessages: readonly { readonly role: string }[],
  pending: LocalSend | null,
  confirmed = false,
): ThreadMessageLike[] {
  if (!pending) return [...messages];
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
