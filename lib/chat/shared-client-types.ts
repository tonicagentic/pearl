/**
 * Shared chat DTO shapes for web + mobile clients.
 * Relative imports only so Expo/mobile tsconfig can resolve this file.
 */
import type { ClientSessionState, SessionStreamEvent } from "eve/client";

import type { QuickTurn } from "./quick-turns.ts";
import type { SpokenTurn } from "./spoken-turns.ts";
import type {
  AgentMarkBrows,
  AgentMarkGaze,
  AgentMarkShape,
  AgentMarkTalk,
} from "../custom-agents/mark.ts";

export type ChatPresence = "working" | "waiting" | "unread" | "idle";

export type ChatListItem = {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly projectId?: string | null;
  readonly remoteAgentId?: string | null;
  readonly waitingForInput: boolean;
  readonly presence: ChatPresence;
};

export type ChatSearchHit = {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly projectId: string | null;
  readonly waitingForInput: boolean;
  readonly presence: ChatPresence;
  readonly snippet: string | null;
};

export type CustomAgentRef = {
  readonly id: string;
  readonly name: string;
  readonly accent: string;
  readonly markShape: AgentMarkShape;
  readonly markTalk: AgentMarkTalk;
  readonly markBrows: AgentMarkBrows;
  readonly markGaze: AgentMarkGaze;
  readonly instructions: string;
};

export type ActiveChat = {
  readonly events: readonly SessionStreamEvent[];
  readonly id: string;
  readonly pendingUserMessage: string | null;
  readonly projectId: string | null;
  readonly remoteAgentId: string | null;
  readonly customAgent: CustomAgentRef | null;
  readonly session: ClientSessionState | undefined;
  readonly spokenTurns: readonly SpokenTurn[];
  readonly quickTurns: readonly QuickTurn[];
  readonly title: string;
};
