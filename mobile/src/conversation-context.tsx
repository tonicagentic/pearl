import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type { ConversationAgentSession, EveMessage } from "eve/client";

import type { PendingWaitKind } from "./message-projection";

export type ChatConversation = {
  readonly messages: readonly EveMessage[];
  readonly agents?: Readonly<Record<string, ConversationAgentSession>>;
};

type ConversationContextValue = {
  readonly conversation: ChatConversation;
  readonly waitKind: PendingWaitKind | null;
};

const ConversationContext = createContext<ConversationContextValue>({
  conversation: { messages: [] },
  waitKind: null,
});

export function ConversationProvider({
  conversation,
  waitKind,
  children,
}: {
  readonly conversation: ChatConversation;
  readonly waitKind: PendingWaitKind | null;
  readonly children: ReactNode;
}) {
  return (
    <ConversationContext.Provider value={{ conversation, waitKind }}>
      {children}
    </ConversationContext.Provider>
  );
}

export function useChatConversation(): ConversationContextValue {
  return useContext(ConversationContext);
}

/** Child session owned by a parent delegation call, if the store is following it. */
export function agentForCall(
  agents: Readonly<Record<string, ConversationAgentSession>> | undefined,
  callId: string | undefined,
): ConversationAgentSession | undefined {
  if (!agents || !callId) return undefined;
  return Object.values(agents).find((agent) => {
    if (agent.callId === callId) return true;
    return "callId" in agent.owner && agent.owner.callId === callId;
  });
}
