import type { ClientSessionState, SessionStreamEvent } from "eve/client";
import type { QuickTurn } from "@/lib/chat/quick-turns";
import type { SpokenTurn } from "@/lib/chat/spoken-turns";
import type { CustomAgentRef } from "@/lib/custom-agents/types";

export type Viewer = {
  readonly email: string;
  readonly id: string;
  readonly image: string | null;
  readonly name: string;
};

export type AuthMode = "email" | "local-dev" | "password" | "unconfigured" | "vercel";
export type StorageMode = "browser" | "database";

export type ChatPresence = "working" | "waiting" | "unread" | "idle";

export type ChatListItem = {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly projectId?: string | null;
  /** Connected remote eve agent for this thread; null/undefined = Pearl. */
  readonly remoteAgentId?: string | null;
  /** Parked on an approval, question, or authorization the user must answer. */
  readonly waitingForInput: boolean;
  /** Home-list status: working / waiting / unread / idle. */
  readonly presence: ChatPresence;
};

export type ChatListPage = {
  readonly items: readonly ChatListItem[];
  readonly nextCursor: string | null;
};

/** Result row from full chat history search (title and/or event text). */
export type ChatSearchHit = {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly projectId: string | null;
  readonly waitingForInput: boolean;
  readonly presence: ChatPresence;
  /** Short match excerpt when the hit came from event text rather than title. */
  readonly snippet: string | null;
};

export type ActiveChat = {
  readonly events: readonly SessionStreamEvent[];
  readonly id: string;
  readonly pendingUserMessage: string | null;
  readonly projectId: string | null;
  /** Connected remote eve agent for this thread; null = Pearl. */
  readonly remoteAgentId: string | null;
  /** User-defined agent identity when this is that agent's durable thread. */
  readonly customAgent: CustomAgentRef | null;
  readonly session: ClientSessionState | undefined;
  readonly spokenTurns: readonly SpokenTurn[];
  readonly quickTurns: readonly QuickTurn[];
  readonly title: string;
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
