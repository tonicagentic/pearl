import type { HistoryChatActionHandlers } from "@/components/home/history-list";

/** Android / web stub — iOS uses `chat-history-list.ios.tsx`. */
export function ChatHistoryListIOS(_props: {
  readonly onOpenChat: (chatId: string) => void;
  readonly actions: HistoryChatActionHandlers;
}) {
  return null;
}
