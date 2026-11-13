import type { ChatListItem, ChatPresence } from "@/src/chats-client";

export type { ChatPresence };

/** Resolve list presence, including older payloads that only had waitingForInput. */
export function chatListPresence(
  chat: Pick<ChatListItem, "waitingForInput" | "presence">,
  options: { readonly active?: boolean } = {},
): ChatPresence {
  const presence =
    chat.presence ??
    (chat.waitingForInput ? "waiting" : "idle");
  // The open chat is never unread.
  if (options.active && presence === "unread") return "idle";
  return presence;
}

export function chatPresenceAccessibilityLabel(
  title: string,
  presence: ChatPresence,
): string {
  switch (presence) {
    case "waiting":
      return `${title}, waiting for your reply`;
    case "working":
      return `${title}, agent is working`;
    case "unread":
      return `${title}, unread reply`;
    default:
      return title;
  }
}

export const CHAT_PRESENCE_AMBER = "#F59E0B";
export const CHAT_PRESENCE_BLUE = "#3B82F6";
