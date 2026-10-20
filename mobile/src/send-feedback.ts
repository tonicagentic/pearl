import type { AppendMessage, ThreadMessageLike } from "@assistant-ui/react-native";

/** Display-only row while the durable pending marker is being written. */
export type LocalSend = {
  readonly store: object;
  readonly baseline: number;
  readonly eventBaseline: number;
  readonly preview: ThreadMessageLike;
  readonly phase: "preparing" | "uncertain";
};

export function createLocalSend(
  store: object,
  baseline: number,
  eventBaseline: number,
  message: AppendMessage,
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
  };
}

/** Eve resolves send() even when prepareSend failed before network dispatch. */
export function shouldRestoreUnsentDraft(status: string, sendPrepared: boolean): boolean {
  return status === "error" && !sendPrepared;
}

/** Only this event proves Eve accepted the turn; an optimistic row alone does not. */
export function hasConfirmedSend(
  events: readonly { readonly type: string }[],
  pending: LocalSend,
): boolean {
  return events.slice(pending.eventBaseline).some((event) => event.type === "message.received");
}

/** Do not replace an unconfirmed turn's recovery state with a later send. */
export function hasUnresolvedSend(
  events: readonly { readonly type: string }[],
  localSend: LocalSend | null,
  pendingMessage: string | null,
): boolean {
  return localSend ? !hasConfirmedSend(events, localSend) : Boolean(pendingMessage);
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
  if (userIndex >= 0 && confirmed) return next;
  const index = userIndex >= 0 ? userIndex : next.length;
  const row = userIndex >= 0 ? next[userIndex] : pending.preview;
  next[index] = {
    ...row,
    metadata: {
      ...row.metadata,
      custom: { ...row.metadata?.custom, mobileSendState: pending.phase },
    },
  };
  return next;
}
