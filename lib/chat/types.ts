import type { ChatListItem } from "@/lib/chat/shared-client-types";

export type {
  ActiveChat,
  ChatListItem,
  ChatPresence,
  ChatSearchHit,
  CustomAgentRef,
} from "@/lib/chat/shared-client-types";

export type Viewer = {
  readonly email: string;
  readonly id: string;
  readonly image: string | null;
  readonly name: string;
};

export type AuthMode = "email" | "local-dev" | "password" | "unconfigured" | "vercel";
export type StorageMode = "browser" | "database";

export type ChatListPage = {
  readonly items: readonly ChatListItem[];
  readonly nextCursor: string | null;
};

export type SetupStatus = {
  readonly appReady: boolean;
  readonly authMode: AuthMode;
  readonly authReady: boolean;
  readonly connectionsAvailable: boolean;
  readonly databaseConfigured: boolean;
  readonly databaseReady: boolean;
  readonly databaseSchemaReady: boolean;
  readonly missing: readonly string[];
  readonly rateLimitReady: boolean;
  readonly storageMode: StorageMode;
};
