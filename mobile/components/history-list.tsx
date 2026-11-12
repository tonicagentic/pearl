import type { ChatListItem } from "@/src/chats-client";

/** Destinations opened from home. */
export type SidebarDestination = "/projects" | "/issues" | "/settings";

export type HistoryChatActionHandlers = {
  readonly onRename: (chat: ChatListItem) => void;
  readonly onViewCost: (chat: ChatListItem) => void;
  readonly onMoveToProject: (chat: ChatListItem) => void;
  readonly onRemoveFromProject: (chat: ChatListItem) => void;
  readonly onDelete: (chat: ChatListItem) => void;
};

/** Android / web stub — iOS uses `history-list.ios.tsx`. */
export function HistoryListIOS(_props: {
  readonly searchQuery?: string;
  readonly onOpenChat: () => void;
  readonly onNavigate: (href: SidebarDestination) => void;
  readonly actions: HistoryChatActionHandlers;
}) {
  return null;
}
