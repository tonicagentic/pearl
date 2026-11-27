/**
 * Merge per-delta live reply text into projected thread messages so the UI
 * can paint ahead of eve's line-boundary snapshot commits.
 *
 * Pure: callers pass parts for the active session only. A live turnId that
 * disagrees with the last assistant row's metadata is not spliced in.
 */

type ContentPart = {
  readonly type?: string;
  readonly text?: string;
  readonly id?: string;
  readonly [key: string]: unknown;
};

type ThreadMessageLike = {
  readonly role: string;
  readonly content?: readonly ContentPart[] | string;
  readonly status?: { readonly type?: string };
  readonly metadata?: unknown;
  readonly [key: string]: unknown;
};

export type LiveReplyOverlayPart = {
  readonly id: string;
  readonly text: string;
  readonly turnId?: string | null;
};

function assistantTurnId(message: ThreadMessageLike): string | null {
  const metadata = message.metadata as
    | {
        readonly custom?: { readonly turnId?: unknown };
        readonly turnId?: unknown;
      }
    | undefined;
  const fromCustom = metadata?.custom?.turnId;
  if (typeof fromCustom === "string") return fromCustom;
  const fromTop = metadata?.turnId;
  return typeof fromTop === "string" ? fromTop : null;
}

function partsForAssistantRow(
  liveParts: readonly LiveReplyOverlayPart[],
  rowTurnId: string | null,
): LiveReplyOverlayPart[] {
  if (rowTurnId === null) return [...liveParts];
  return liveParts.filter(
    (part) => part.turnId == null || part.turnId === rowTurnId,
  );
}

export function applyLiveReplyOverlay(
  messages: readonly ThreadMessageLike[],
  liveParts: readonly LiveReplyOverlayPart[],
): ThreadMessageLike[] {
  if (liveParts.length === 0) return messages as ThreadMessageLike[];

  const last = messages[messages.length - 1];
  if (!last) {
    return [
      {
        role: "assistant",
        status: { type: "running" },
        content: liveParts.map((part) => ({
          type: "text" as const,
          text: part.text,
          id: part.id,
        })),
      },
    ];
  }

  if (last.role !== "assistant") {
    return [
      ...messages,
      {
        role: "assistant",
        status: { type: "running" },
        content: liveParts.map((part) => ({
          type: "text" as const,
          text: part.text,
          id: part.id,
        })),
      },
    ];
  }

  const applicable = partsForAssistantRow(liveParts, assistantTurnId(last));
  if (applicable.length === 0) return messages as ThreadMessageLike[];

  const content: ContentPart[] = Array.isArray(last.content)
    ? [...last.content]
    : [];

  for (const live of applicable) {
    const index = content.findIndex(
      (part) => part.type === "text" && part.id === live.id,
    );
    if (index >= 0) {
      const existing = content[index]!;
      const existingText =
        typeof existing.text === "string" ? existing.text : "";
      if (live.text.length > existingText.length) {
        content[index] = { ...existing, text: live.text };
      }
      continue;
    }
    // Prefer matching a text part without an id (projection historically omitted it).
    const anonymous = content.findIndex(
      (part) =>
        part.type === "text" &&
        part.id === undefined &&
        typeof part.text === "string",
    );
    if (anonymous >= 0) {
      const existing = content[anonymous]!;
      const existingText =
        typeof existing.text === "string" ? existing.text : "";
      if (live.text.length > existingText.length) {
        content[anonymous] = { ...existing, id: live.id, text: live.text };
      }
      continue;
    }
    content.push({ type: "text", text: live.text, id: live.id });
  }

  const next = [...messages];
  next[next.length - 1] = {
    ...last,
    content,
    status: last.status ?? { type: "running" },
  };
  return next;
}
