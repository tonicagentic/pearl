"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_MODEL_KEY,
  getModelSelection,
} from "@/app/_components/model-selection";
import { getRemoteAgentSelection } from "@/app/_components/remote-agent-selection";
import { readQuickPathStream } from "@/lib/chat/quick-path-stream";
import type { QuickTurn } from "@/lib/chat/quick-turns";
import { canUseQuickPath } from "@/lib/pearl-lane";

export type QuickPathOutcome = "answered" | "escalate" | "ineligible" | "error";

export type QuickPathSendContext = {
  readonly chatId: string | null;
  readonly projectId: string | null;
  readonly customAgentId: string | null;
  readonly hasEveSession: boolean;
  readonly onChatId: (chatId: string) => void;
  readonly onTurns: (turns: readonly QuickTurn[], title?: string) => void;
};

type QuickPathContextValue = {
  readonly turns: readonly QuickTurn[];
  readonly streamingText: string;
  readonly isStreaming: boolean;
  readonly setTurns: (turns: readonly QuickTurn[]) => void;
  readonly clearTurns: () => void;
  /**
   * Attempt the session-free quick path. Returns:
   * - answered: reply saved; do not send to eve
   * - escalate / ineligible / error: caller should send through eve
   */
  readonly tryQuickSend: (input: {
    readonly text: string;
    readonly hasAttachments: boolean;
  }) => Promise<QuickPathOutcome>;
};

const QuickPathContext = createContext<QuickPathContextValue | null>(null);

export function QuickPathProvider({
  initialTurns = [],
  getSendContext,
  children,
}: {
  readonly initialTurns?: readonly QuickTurn[];
  readonly getSendContext: () => QuickPathSendContext;
  readonly children: ReactNode;
}) {
  const [turns, setTurnsState] = useState<readonly QuickTurn[]>(initialTurns);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    setTurnsState(initialTurns);
  }, [initialTurns]);

  const setTurns = useCallback((next: readonly QuickTurn[]) => {
    setTurnsState(next);
  }, []);

  const clearTurns = useCallback(() => {
    setTurnsState([]);
    setStreamingText("");
  }, []);

  const tryQuickSend = useCallback(
    async (input: {
      readonly text: string;
      readonly hasAttachments: boolean;
    }): Promise<QuickPathOutcome> => {
      const text = input.text.trim();
      const send = getSendContext();
      if (send.hasEveSession) return "ineligible";

      const pinned = getModelSelection() !== DEFAULT_MODEL_KEY;
      if (
        !canUseQuickPath({
          text,
          hasEveSession: false,
          hasAttachments: input.hasAttachments,
          hasCustomAgent: Boolean(send.customAgentId),
          hasRemoteAgent: Boolean(getRemoteAgentSelection()),
          hasProject: Boolean(send.projectId),
          hasPinnedModel: pinned,
          quickTurnCount: turns.length,
        })
      ) {
        return "ineligible";
      }

      setIsStreaming(true);
      setStreamingText("");
      const optimisticUser: QuickTurn = {
        id: `quick:pending:${Date.now()}`,
        role: "user",
        text,
      };
      setTurnsState((current) => [...current, optimisticUser]);
      try {
        const response = await fetch("/api/chat/quick", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chatId: send.chatId || null,
            message: text,
          }),
        });

        if (response.status === 409) {
          setTurnsState((current) =>
            current.filter((turn) => turn.id !== optimisticUser.id),
          );
          setStreamingText("");
          return "escalate";
        }

        const result = await readQuickPathStream(response, {
          onTextDelta: (delta) => {
            setStreamingText((current) => current + delta);
          },
        });

        if (result.outcome === "escalate") {
          setTurnsState((current) =>
            current.filter((turn) => turn.id !== optimisticUser.id),
          );
          setStreamingText("");
          return "escalate";
        }
        if (result.outcome === "error") {
          setTurnsState((current) =>
            current.filter((turn) => turn.id !== optimisticUser.id),
          );
          setStreamingText("");
          return "error";
        }

        if (!send.chatId || send.chatId !== result.chatId) {
          send.onChatId(result.chatId);
        }
        setTurnsState(result.turns);
        send.onTurns(result.turns, result.title);
        setStreamingText("");
        return "answered";
      } catch {
        setTurnsState((current) =>
          current.filter((turn) => turn.id !== optimisticUser.id),
        );
        setStreamingText("");
        return "error";
      } finally {
        setIsStreaming(false);
      }
    },
    [getSendContext, turns.length],
  );

  const value = useMemo(
    () => ({
      turns,
      streamingText,
      isStreaming,
      setTurns,
      clearTurns,
      tryQuickSend,
    }),
    [turns, streamingText, isStreaming, setTurns, clearTurns, tryQuickSend],
  );

  return (
    <QuickPathContext.Provider value={value}>
      {children}
    </QuickPathContext.Provider>
  );
}

export function useQuickPath(): QuickPathContextValue {
  const value = useContext(QuickPathContext);
  if (!value) {
    throw new Error("useQuickPath must be used within QuickPathProvider.");
  }
  return value;
}

export function useOptionalQuickPath(): QuickPathContextValue | null {
  return useContext(QuickPathContext);
}
