"use client";

import {
  useEveAgentRuntime,
  useEveError,
  useEveSession,
} from "@assistant-ui/eve";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import type {
  EveAgentStoreSnapshot,
  EveMessageData,
  MessageStreamEvent,
  PrepareSend,
} from "eve/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useChatShell } from "@/app/_components/chat-shell-context";
import { ErrorToast } from "@/app/_components/error-toast";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import {
  ReadFileToolUI,
  WriteFileToolUI,
} from "@/components/assistant-ui/elements/file-tool.aui";
import { EveAuthorization } from "@/components/eve-authorization";
import {
  appendClientChatEvent,
  checkClientSendLimit,
  createClientChat,
  saveClientChatSession,
  saveClientChatSnapshot,
} from "@/lib/chat/persistence-client";
import { createFallbackTitle } from "@/lib/chat/title";
import type { ActiveChat, StorageMode } from "@/lib/chat/types";

const EMPTY_EVENTS: readonly MessageStreamEvent[] = [];

type AssistantChatSurfaceProps = {
  /**
   * Real chat id once the chat row exists, or null for a brand-new chat
   * (the row is created in prepareSend before the first turn).
   */
  readonly chatId: string | null;
  /** Loaded chat used to seed the runtime. Callers must remount (key) when it loads. */
  readonly activeChat: ActiveChat | null;
  readonly pendingUserMessage?: string | null;
  readonly onChatCreated?: (chatId: string) => void;
  readonly onPendingUserMessageSettled?: (message?: string) => void;
  readonly onActiveChatUpdated?: (chat: ActiveChat) => void;
};

export function AssistantChatSurface({
  chatId,
  activeChat,
  pendingUserMessage = null,
  onChatCreated,
  onPendingUserMessageSettled,
  onActiveChatUpdated,
}: AssistantChatSurfaceProps) {
  const { requestSignIn, setActiveChatId, setupStatus, touchChat, viewer } =
    useChatShell();
  const storageMode = setupStatus.storageMode;
  const [clientError, setClientError] = useState<string | null>(null);
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const activeChatIdRef = useRef<string | null>(chatId);
  const eventIndexRef = useRef(activeChat?.events.length ?? 0);
  const savedEventCountRef = useRef(activeChat?.events.length ?? 0);
  const currentTitleRef = useRef(activeChat?.title ?? "New chat");

  const isDisabled = !viewer || !setupStatus.appReady;

  const persistStreamEvent = useCallback(
    (event: MessageStreamEvent) => {
      const id = activeChatIdRef.current;

      if (!id) {
        return;
      }

      const eventIndex = eventIndexRef.current;
      eventIndexRef.current += 1;

      void appendClientChatEvent(storageMode, {
        chatId: id,
        event,
        eventIndex,
      }).catch((error) => {
        setClientError(
          error instanceof Error
            ? error.message
            : "Failed to save stream progress.",
        );
      });
    },
    [storageMode],
  );

  const persistSnapshot = useCallback(
    (snapshot: EveAgentStoreSnapshot<EveMessageData>) => {
      const id = activeChatIdRef.current;

      if (!id) {
        return;
      }

      void (async () => {
        try {
          const events = snapshot.events;
          const session = snapshot.session;

          // eve fires onFinish even when a mount/resume found nothing new.
          // Only treat the snapshot as an update when the event stream
          // actually changed, so idle opens do not reorder the sidebar.
          if (events.length === savedEventCountRef.current) {
            onPendingUserMessageSettled?.();
            return;
          }

          await saveClientChatSnapshot(storageMode, {
            chatId: id,
            events,
            session,
          });
          eventIndexRef.current = events.length;
          savedEventCountRef.current = events.length;
          touchChat({
            id,
            title: currentTitleRef.current,
            updatedAt: new Date().toISOString(),
          });
          onActiveChatUpdated?.({
            id,
            events,
            pendingUserMessage: null,
            session,
            title: currentTitleRef.current,
          });
          onPendingUserMessageSettled?.();
        } catch (error) {
          setClientError(
            error instanceof Error ? error.message : "Failed to save chat.",
          );
        }
      })();
    },
    [onActiveChatUpdated, onPendingUserMessageSettled, storageMode, touchChat],
  );

  const prepareSend = useCallback(
    async (input: Parameters<PrepareSend>[0]): Promise<Parameters<PrepareSend>[0]> => {
      if (!viewer) {
        requestSignIn();
        throw new Error("Sign in to send messages.");
      }

      const messageText =
        typeof input.message === "string" ? input.message : "";

      const limit = await checkClientSendLimit(storageMode, {
        message: messageText,
      });

      if (!limit.allowed) {
        throw new Error(`${limit.message} Retry in ${limit.retryAfter}s.`);
      }

      if (!activeChatIdRef.current) {
        const created = await createClientChat(storageMode, {
          pendingUserMessage: messageText,
        });
        activeChatIdRef.current = created.id;
        setActiveChatId(created.id);
        touchChat(created);
        onChatCreated?.(created.id);
      }

      if (messageText) {
        currentTitleRef.current = createFallbackTitle(messageText);
      }

      return input;
    },
    [
      onChatCreated,
      requestSignIn,
      setActiveChatId,
      storageMode,
      touchChat,
      viewer,
    ],
  );

  const runtime = useEveAgentRuntime({
    resume: Boolean(activeChat?.session),
    initialEvents: activeChat?.events ?? EMPTY_EVENTS,
    initialSession: activeChat?.session,
    onEvent: persistStreamEvent,
    onFinish: persistSnapshot,
    prepareSend,
    isDisabled,
  });

  const thread = runtime.thread;

  useEffect(() => {
    const update = () => setIsRunning(thread.getState().isRunning);
    update();
    return thread.subscribe(update);
  }, [thread]);

  useEffect(() => {
    if (isDisabled || isRunning || !pendingUserMessage) {
      return;
    }

    onPendingUserMessageSettled?.(pendingUserMessage);
    thread.append(pendingUserMessage);
  }, [
    isDisabled,
    isRunning,
    onPendingUserMessageSettled,
    pendingUserMessage,
    thread,
  ]);

  const toastError =
    clientError !== null && dismissedError !== clientError ? clientError : null;

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex min-h-0 flex-1 flex-col">
        {toastError ? (
          <ErrorToast
            message={toastError}
            onDismiss={() => setDismissedError(clientError)}
          />
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col">
          <WriteFileToolUI />
          <ReadFileToolUI />
          <Thread />
        </div>

        <EveAuthorization />
      </div>

      <SessionCursorPersistence chatId={chatId} storageMode={storageMode} />
      <EveErrorToast />
    </AssistantRuntimeProvider>
  );
}

function EveErrorToast() {
  const eveError = useEveError();
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    setDismissed(null);
  }, [eveError]);

  const message = eveError?.message ?? null;

  if (!message || dismissed === message) {
    return null;
  }

  return (
    <ErrorToast message={message} onDismiss={() => setDismissed(message)} />
  );
}

function SessionCursorPersistence({
  chatId,
  storageMode,
}: {
  readonly chatId: string | null;
  readonly storageMode: StorageMode;
}) {
  const session = useEveSession();

  useEffect(() => {
    if (!chatId || !session?.sessionId) {
      return;
    }

    void saveClientChatSession(storageMode, { chatId, session }).catch(
      () => {},
    );
  }, [chatId, session, storageMode]);

  return null;
}
