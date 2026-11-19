import type { ChatHistorySearchFeed } from "@/components/home/chat-history-types";
import type { HistoryChatActionHandlers } from "@/components/home/history-list";

export type { ChatHistorySearchFeed } from "@/components/home/chat-history-types";

/** Android / web stub — iOS uses `chat-history-list.ios.tsx`. */
export function ChatHistoryListIOS(_props: {
  readonly onOpenChat: (chatId: string) => void;
  readonly actions: HistoryChatActionHandlers;
  readonly search: ChatHistorySearchFeed;
}) {
  return null;
}
