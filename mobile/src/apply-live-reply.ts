/**
 * Merge per-delta live reply text into projected thread messages so the UI
 * can paint ahead of eve's line-boundary snapshot commits.
 */

import { getLiveReplyParts } from "./live-reply-text.ts";

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

export function applyLiveReplyOverlay(
  messages: readonly ThreadMessageLike[],
): ThreadMessageLike[] {
  const liveParts = getLiveReplyParts();
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

  const content: ContentPart[] = Array.isArray(last.content)
    ? [...last.content]
    : [];

  for (const live of liveParts) {
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
