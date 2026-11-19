import type { ChatListItem } from "@/src/chats-client";

export type HistoryChatActionHandlers = {
  readonly onRename: (chat: ChatListItem) => void;
  readonly onViewCost: (chat: ChatListItem) => void;
  readonly onMoveToProject: (chat: ChatListItem) => void;
  readonly onRemoveFromProject: (chat: ChatListItem) => void;
  readonly onDelete: (chat: ChatListItem) => void;
};

/** Android / web stub — iOS uses `history-list.ios.tsx`. */
export function HistoryListIOS(_props: {
  readonly onOpenChat: () => void;
  readonly actions: HistoryChatActionHandlers;
  readonly bottomInset?: number;
  readonly onCreateProject?: () => void;
  readonly onCreateAgent?: () => void;
}) {
  return null;
}
