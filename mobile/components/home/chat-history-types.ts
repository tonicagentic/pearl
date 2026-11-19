import type { ChatListItem } from "@/src/chats-client";

export type ChatHistorySearchFeed = {
  readonly active: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  readonly hits: readonly ChatListItem[] | null;
};
