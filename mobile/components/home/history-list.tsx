import type { ChatListItem } from "@/src/chats-client";

export type HistoryChatActionHandlers = {
  readonly onRename: (chat: ChatListItem) => void;
  readonly onViewCost: (chat: ChatListItem) => void;
  readonly onMoveToProject: (chat: ChatListItem) => void;
  readonly onRemoveFromProject: (chat: ChatListItem) => void;
  readonly onDelete: (chat: ChatListItem) => void;
};
