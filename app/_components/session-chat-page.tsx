"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AssistantChatSurface } from "@/app/_components/assistant-chat";
import { ErrorToast } from "@/app/_components/error-toast";
import {
  CHAT_ROUTE_SYNC_EVENT,
  type ChatRouteSyncDetail,
} from "@/app/_components/agent-chat-events";
import { useChatShell } from "@/app/_components/chat-shell-context";
import {
  clearPendingChatMessage,
  isProvisionalChatId,
  readPendingChatMessage,
  writePendingChatMessage,
} from "@/lib/chat/provisional-chat";
import {
  createClientChat,
  getClientChat,
} from "@/lib/chat/persistence-client";
import type { ActiveChat } from "@/lib/chat/types";

export function SessionChatPage({
  chatId,
  children,
}: {
  readonly chatId: string;
  readonly children: ReactNode;
}) {
  const { setActiveChatId, setupStatus, touchChat, viewer } = useChatShell();
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const currentChatIdRef = useRef(chatId);
  const provisionalCreateStartedRef = useRef(new Set<string>());
  const settledPendingMessagesRef = useRef(new Set<string>());
  const isProvisionalChat = isProvisionalChatId(chatId);
  const router = useRouter();
  const toastError = clientError && dismissedError !== clientError ? clientError : null;
  const isLoadingChat = !activeChat && !isProvisionalChat;

  useEffect(() => {
    currentChatIdRef.current = chatId;
  }, [chatId]);

  useEffect(() => {
    setActiveChat(null);
    setPendingUserMessage(null);
    settledPendingMessagesRef.current = new Set();
  }, [chatId]);

  useEffect(() => {
    const restoredPendingMessage = readPendingChatMessage(chatId);

    if (restoredPendingMessage) {
      setPendingUserMessage((current) => current ?? restoredPendingMessage);
      setClientError(null);
    }
  }, [chatId]);

  useEffect(() => {
    if (!isProvisionalChat || !viewer || !setupStatus.appReady) {
      return;
    }

    const pendingMessage = readPendingChatMessage(chatId);

    if (!pendingMessage) {
      setClientError("Message could not be restored. Start a new chat.");
      return;
    }

    setPendingUserMessage((current) => current ?? pendingMessage);

    if (provisionalCreateStartedRef.current.has(chatId)) {
      return;
    }

    provisionalCreateStartedRef.current.add(chatId);
    setClientError(null);

    void (async () => {
      try {
        const created = await createClientChat(setupStatus.storageMode, {
          pendingUserMessage: pendingMessage,
        });

        if (currentChatIdRef.current !== chatId) {
          return;
        }

        writePendingChatMessage(created.id, pendingMessage);
        clearPendingChatMessage(chatId);
        touchChat(created);
        setActiveChatId(created.id);
        router.replace(`/chat/${created.id}`, { scroll: false });
      } catch (error) {
        if (currentChatIdRef.current !== chatId) {
          return;
        }

        clearPendingChatMessage(chatId);
        setPendingUserMessage(null);

        try {
          window.sessionStorage.setItem("eve-chat-draft", pendingMessage);
        } catch {}

        setClientError(error instanceof Error ? error.message : "Failed to start chat.");
        router.replace("/", { scroll: false });
      }
    })();
  }, [
    chatId,
    isProvisionalChat,
    router,
    setActiveChatId,
    setupStatus.appReady,
    setupStatus.storageMode,
    touchChat,
    viewer,
  ]);

  useEffect(() => {
    setActiveChatId(chatId);

    return () => {
      setActiveChatId(null);
    };
  }, [chatId, setActiveChatId]);

  useEffect(() => {
    const applyRouteSync = (detail: ChatRouteSyncDetail) => {
      if (detail.chatId !== chatId) {
        return;
      }
      setActiveChat((current) => {
        if (!detail.activeChat && current?.id === chatId) {
          return current;
        }

        return detail.activeChat;
      });
      setPendingUserMessage((current) => {
        if (detail.activeChat) {
          return getRestorablePendingUserMessage(
            detail.activeChat.pendingUserMessage,
            settledPendingMessagesRef.current,
          );
        }

        return current;
      });
    };
    const target = window as Window & {
      __eveChatRouteSync?: ChatRouteSyncDetail;
    };
    const handleRouteSync = (event: Event) => {
      applyRouteSync((event as CustomEvent<ChatRouteSyncDetail>).detail);
    };

    window.addEventListener(CHAT_ROUTE_SYNC_EVENT, handleRouteSync);
    if (target.__eveChatRouteSync) {
      applyRouteSync(target.__eveChatRouteSync);
    }

    return () => {
      window.removeEventListener(CHAT_ROUTE_SYNC_EVENT, handleRouteSync);
    };
  }, [chatId]);

  useEffect(() => {
    if (!viewer || !setupStatus.appReady || isProvisionalChat) {
      return;
    }

    const abortController = new AbortController();
    let cancelled = false;

    void (async () => {
      try {
        const chat = await getClientChat(setupStatus.storageMode, chatId);

        if (cancelled) {
          return;
        }

        if (!chat) {
          setClientError("Chat not found.");
          return;
        }

        setActiveChat(chat);
        const nextPendingUserMessage = getRestorablePendingUserMessage(
          chat.pendingUserMessage,
          settledPendingMessagesRef.current,
        );

        setPendingUserMessage(nextPendingUserMessage);

        if (!nextPendingUserMessage) {
          clearPendingChatMessage(chatId);
        }
        setClientError(null);
      } catch (error) {
        if (!cancelled && !abortController.signal.aborted) {
          setClientError(
            error instanceof Error ? error.message : "Failed to load chat history.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [
    chatId,
    isProvisionalChat,
    setupStatus.appReady,
    setupStatus.storageMode,
    viewer,
  ]);

  useEffect(() => {
    setDismissedError(null);
  }, [clientError]);

  const handlePendingUserMessageSettled = useCallback((message?: string) => {
    clearPendingChatMessage(chatId);

    if (message) {
      settledPendingMessagesRef.current.add(message);
    }

    setPendingUserMessage((current) =>
      !message || current === message ? null : current,
    );
  }, [chatId]);

  const handleActiveChatUpdated = useCallback((nextActiveChat: ActiveChat) => {
    setActiveChat(nextActiveChat);
    setPendingUserMessage(
      getRestorablePendingUserMessage(
        nextActiveChat.pendingUserMessage,
        settledPendingMessagesRef.current,
      ),
    );
  }, []);

  // The runtime seeds its store on mount, so remount once the chat has loaded
  // (or failed) rather than replaying an empty event list.
  const surfaceKey = isProvisionalChat
    ? `${chatId}:provisional`
    : activeChat
      ? `${chatId}:loaded`
      : `${chatId}:unresolved`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {toastError ? (
        <ErrorToast
          message={toastError}
          onDismiss={() => setDismissedError(toastError)}
        />
      ) : null}

      <AssistantChatSurface
        activeChat={activeChat}
        chatId={isProvisionalChat ? null : chatId}
        key={surfaceKey}
        pendingUserMessage={pendingUserMessage}
        onActiveChatUpdated={handleActiveChatUpdated}
        onPendingUserMessageSettled={handlePendingUserMessageSettled}
      />

      <div className="hidden" aria-hidden>
        {children}
      </div>
    </div>
  );
}

function getRestorablePendingUserMessage(
  pendingUserMessage: string | null | undefined,
  settledMessages: ReadonlySet<string>,
) {
  if (!pendingUserMessage || settledMessages.has(pendingUserMessage)) {
    return null;
  }

  return pendingUserMessage;
}
