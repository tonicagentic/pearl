import type { ChatListItem, ChatPresence } from "../chats-client";

/** Row fields the Recents list renders. Unchanged polls must keep identity. */
export function sameChatRows(
  current: readonly ChatListItem[],
  next: readonly ChatListItem[],
): boolean {
  if (current.length !== next.length) return false;
  for (let i = 0; i < current.length; i += 1) {
    const a = current[i]!;
    const b = next[i]!;
    if (
      a.id !== b.id ||
      a.title !== b.title ||
      a.updatedAt !== b.updatedAt ||
      (a.projectId ?? null) !== (b.projectId ?? null) ||
      (a.presence ?? "idle") !== (b.presence ?? "idle") ||
      Boolean(a.waitingForInput) !== Boolean(b.waitingForInput)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Apply a page-1 listChats result.
 * Silent polls merge into already-loaded pages so presence does not drop
 * history the user scrolled into. Full reloads replace.
 */
export function applyChatListPage(input: {
  readonly current: readonly ChatListItem[];
  readonly page: readonly ChatListItem[];
  readonly silent: boolean;
}): readonly ChatListItem[] {
  const { current, page, silent } = input;
  if (!silent || current.length === 0) {
    return sameChatRows(current, page) ? current : page;
  }

  const freshById = new Map(page.map((chat) => [chat.id, chat]));
  const seen = new Set<string>();
  const merged: ChatListItem[] = [];
  for (const chat of page) {
    merged.push(chat);
    seen.add(chat.id);
  }
  for (const chat of current) {
    if (seen.has(chat.id)) continue;
    const updated = freshById.get(chat.id);
    merged.push(updated ?? chat);
    seen.add(chat.id);
  }
  return sameChatRows(current, merged) ? current : merged;
}

/** Append a load-more page, dropping ids already in the list. */
export function appendChatListPage(
  current: readonly ChatListItem[],
  page: readonly ChatListItem[],
): readonly ChatListItem[] {
  if (page.length === 0) return current;
  const seen = new Set(current.map((chat) => chat.id));
  const extra = page.filter((chat) => !seen.has(chat.id));
  if (extra.length === 0) return current;
  return [...current, ...extra];
}

/** True when this fetch generation is still the latest. */
export function isCurrentGeneration(
  stamp: number,
  current: number,
): boolean {
  return stamp === current;
}

const LIVE_PRESENCE = new Set<ChatPresence>(["working", "waiting", "unread"]);

/**
 * Patch one Recents row from a push or presence poll.
 * Live presence bumps updatedAt and moves the row to the top.
 */
export function applyChatPresence(
  current: readonly ChatListItem[],
  chatId: string,
  presence: ChatPresence,
  updatedAt?: string,
): readonly ChatListItem[] {
  const index = current.findIndex((chat) => chat.id === chatId);
  if (index < 0) return current;
  const existing = current[index]!;
  const nextUpdatedAt = updatedAt ?? existing.updatedAt;
  const waitingForInput = presence === "waiting";
  if (
    existing.presence === presence &&
    Boolean(existing.waitingForInput) === waitingForInput &&
    existing.updatedAt === nextUpdatedAt
  ) {
    return current;
  }

  const patched: ChatListItem = {
    ...existing,
    presence,
    waitingForInput,
    updatedAt: nextUpdatedAt,
  };

  if (LIVE_PRESENCE.has(presence) && index !== 0) {
    const rest = current.filter((chat) => chat.id !== chatId);
    return [patched, ...rest];
  }

  const next = [...current];
  next[index] = patched;
  return next;
}

/** Patch title / updatedAt after a quick-path answer (no presence invent). */
export function applyChatMeta(
  current: readonly ChatListItem[],
  chatId: string,
  meta: { readonly title?: string; readonly updatedAt?: string },
): readonly ChatListItem[] {
  const index = current.findIndex((chat) => chat.id === chatId);
  if (index < 0) return current;
  const existing = current[index]!;
  const title = meta.title ?? existing.title;
  const updatedAt = meta.updatedAt ?? existing.updatedAt;
  if (title === existing.title && updatedAt === existing.updatedAt) {
    return current;
  }
  const patched: ChatListItem = { ...existing, title, updatedAt };
  if (updatedAt !== existing.updatedAt && index !== 0) {
    return [patched, ...current.filter((chat) => chat.id !== chatId)];
  }
  const next = [...current];
  next[index] = patched;
  return next;
}
