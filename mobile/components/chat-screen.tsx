import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Alert,
  Platform,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  AssistantRuntimeProvider,
  MessageNotSentError,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { dismissKeyboard } from "@/components/dismiss-keyboard";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { EveAuthorization } from "@/components/assistant-ui/elements/authorization";
import {
  ChatFilesSegment,
  type MainTab,
} from "@/components/chat-files-segment";
import { ThreadActionsDrawer } from "@/components/thread-actions-drawer";
import { ThreadCostDrawer } from "@/components/thread-cost-drawer";
import { ComputerPanel } from "@/components/computer-panel";
import { ProjectPickerModal } from "@/components/project-picker-modal";
import { getAgentMode } from "@/src/agent-mode";
import { withPendingAssistant } from "@/src/stream-presentation";
import { buildTurnClientContext } from "@/src/turn-client-context";
import { useWorkspace } from "@/src/workspace-context";
import {
  getPendingApprovals,
  hasPendingAction,
} from "@/src/message-projection";
import { createAttachmentMarker, toEveTurn } from "@/src/attachment-content";
import { createLocalSend, hasConfirmedSend, hasUnresolvedSend, projectSendMessages, shouldRestoreUnsentDraft, type LocalSend } from "@/src/send-feedback";
import { useChats } from "@/src/chat-context";
import { toThreadMessages } from "@/src/eve-transport";
import { isEveSessionInactive } from "../../lib/chat/eve-session-recovery";

/**
 * Nested chat thread (route `/chat`): assistant-ui Thread over the eve session.
 * System back / swipe-pop returns to home.
 */
export function ChatScreen({
  chromeRevealed = true,
}: {
  /** False while the auth→composer morph overlay owns the transition. */
  chromeRevealed?: boolean;
} = {}) {
  // The safe-area container is a native codegen view, so uniwind's className
  // binding cannot reach it; paint the theme background through style instead
  // so the color extends under the status bar.
  const insets = useSafeAreaInsets();
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as string | undefined;
  const screenStyle: StyleProp<ViewStyle> = [
    { flex: 1 },
    { backgroundColor },
  ];
  // Match Thread list clearance under the transparent iOS nav.
  const computerTopInset =
    Platform.OS === "ios" ? insets.top + 44 : 0;
  const {
    store,
    activeChatId,
    activeProjectId,
    setActiveProjectId,
    newChatEntry,
    activeTitle,
    persistenceError,
    retrySync,
    pendingMessage,
    deleteChat,
    wasSendPrepared,
    recoverDeadSession,
  } = useChats();
  const { setChatId, tabs } = useWorkspace();
  const [mainTab, setMainTab] = useState<MainTab>("chat");
  const tabCountRef = useRef(tabs.length);

  useEffect(() => {
    setChatId(activeChatId);
  }, [activeChatId, setChatId]);

  // Auto-open Computer when the agent opens the first tab; return to Chat when empty.
  useEffect(() => {
    const prev = tabCountRef.current;
    tabCountRef.current = tabs.length;
    if (prev === 0 && tabs.length > 0) setMainTab("computer");
    else if (tabs.length === 0 && prev > 0) setMainTab("chat");
  }, [tabs.length]);

  const projectPickWaiter = useRef<{
    resolve: (projectId: string) => void;
    reject: (reason?: unknown) => void;
  } | null>(null);
  const autoSentPendingFor = useRef<string | null>(null);
  const [costOpen, setCostOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);

  const ensureProjectForPlanMode = useCallback(async (): Promise<string | null> => {
    if (getAgentMode() !== "plan") return activeProjectId;
    if (activeProjectId) return activeProjectId;
    return new Promise<string>((resolve, reject) => {
      projectPickWaiter.current = { resolve, reject };
      setProjectPickerOpen(true);
    });
  }, [activeProjectId]);

  const openCost = useCallback(() => {
    dismissKeyboard();
    setCostOpen(true);
  }, []);

  const performDelete = useCallback(() => {
    if (!activeChatId) return;
    void deleteChat(activeChatId).catch(() => {
      Alert.alert("Could not delete", "Check your connection and try again.");
    });
  }, [activeChatId, deleteChat]);

  const confirmDelete = useCallback(() => {
    if (!activeChatId) return;
    Alert.alert(
      "Delete thread?",
      "This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: performDelete,
        },
      ],
    );
  }, [activeChatId, performDelete]);

  const openThreadActions = useCallback(() => {
    dismissKeyboard();
    setActionsOpen(true);
  }, []);

  const [sendError, setSendError] = useState<{ store: object; message: string } | null>(null);
  const [localSends, setLocalSends] = useState<Map<object, LocalSend>>(() => new Map());
  const localSend = localSends.get(store) ?? null;
  const messages = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.snapshot.messages,
  );
  const status = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.snapshot.status,
  );
  const storeError = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.snapshot.error,
  );
  const events = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.snapshot.events,
  );
  const conversation = useMemo(() => ({ messages }), [messages]);
  const isBusy = status === "busy";
  const hasError = Boolean(storeError);
  const confirmed = localSend ? hasConfirmedSend(events, localSend) : false;
  const waitingForAction = hasPendingAction(conversation);
  const pendingApprovals = useMemo(
    () => getPendingApprovals(conversation),
    [conversation],
  );
  const projectedMessages = useMemo(
    () => withPendingAssistant(
      projectSendMessages(
        toThreadMessages(conversation, { isRunning: isBusy, hasError }),
        messages,
        confirmed ? null : hasError && localSend
          ? { ...localSend, phase: "uncertain" }
          : localSend,
      ),
      messages,
      isBusy,
      Boolean(localSend && localSend.phase === "preparing" && !confirmed),
    ),
    [conversation, messages, localSend, confirmed, isBusy, hasError],
  );

  // Rebuilt when the store instance changes (chat selection): the adapter
  // closes over the current store, and the runtime core re-syncs on the new
  // adapter object.
  const adapter = useMemo(
    () => ({
      get messages(): ThreadMessageLike[] {
        return projectedMessages;
      },
      // Return the projection as-is: the runtime's converter assigns stable
      // positional fallback ids (the projection omits ids on purpose) and
      // honors the per-message status it carries.
      convertMessage: (message: ThreadMessageLike) => message,
      isRunning: isBusy,
      isDisabled: status === "resuming",
      isSendDisabled: waitingForAction,
      onNew: async (message: AppendMessage) => {
        setSendError(null);
        if (waitingForAction) throw new MessageNotSentError("This chat is waiting for authorization or approval.");
        if (hasUnresolvedSend(store.snapshot.events, localSend, pendingMessage)) {
          const reason = "Check the previous message in this chat before sending another.";
          setSendError({ store, message: reason });
          throw new MessageNotSentError(reason);
        }
        let projectIdForTurn = activeProjectId;
        try {
          projectIdForTurn = await ensureProjectForPlanMode();
          if (projectIdForTurn) setActiveProjectId(projectIdForTurn);
        } catch {
          const reason = "Plan mode needs a project before sending.";
          setSendError({ store, message: reason });
          throw new MessageNotSentError(reason);
        }
        let turn: ReturnType<typeof toEveTurn>;
        try {
          turn = toEveTurn(message);
        } catch (cause) {
          // Only validation failures are known to have never reached eve.
          // Restore the draft and chips; network failures remain uncertain.
          const reason = cause instanceof Error ? cause.message : "Attachment is not ready.";
          setSendError({ store, message: reason });
          throw new MessageNotSentError(reason);
        }
        // Match an attachment-only pending row to this exact eve receive event
        // after a force-quit. The token is just a correlation label, not auth.
        const outgoing = !turn.text.trim() && Array.isArray(turn.message)
          ? [{ type: "text" as const, text: createAttachmentMarker() }, ...turn.message]
          : turn.message;
        // Paint the user turn before the durable marker's network round-trip.
        // This row is display-only; Eve still waits for prepareSend to persist it.
        const preview = createLocalSend(
          store,
          store.snapshot.messages.length,
          store.snapshot.events.length,
          message,
        );
        setLocalSends((current) => new Map(current).set(store, preview));
        // Light tick as the bubble appears; skip validation failures above.
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        const sendPayload = {
          message: outgoing,
          clientContext: buildTurnClientContext(projectIdForTurn),
        };
        try {
          // Mode, project, and model ride the turn as ephemeral clientContext.
          // send() resolves with a Delivery once the server accepts the turn.
          let delivery = await store.send(sendPayload);
          // Dead eve session: start a fresh session on the same chat and retry once.
          if (
            isEveSessionInactive(store.snapshot.error) &&
            recoverDeadSession(store)
          ) {
            delivery = await store.send(sendPayload);
          }
          // Eve reports prepareSend failures through error/onError, not by
          // rejecting send(). Nothing went to Eve if the durable mark failed.
          if (shouldRestoreUnsentDraft(store.snapshot.error, wasSendPrepared(store))) {
            throw new Error("Pending message was not saved.");
          }
          const accepted =
            Boolean(delivery?.deliveryId) ||
            hasConfirmedSend(store.snapshot.events, preview);
          setLocalSends((current) => {
            if (current.get(store)?.preview !== preview.preview) return current;
            const next = new Map(current);
            if (accepted) next.delete(store);
            else next.set(store, { ...preview, phase: "uncertain" });
            return next;
          });
          if (accepted) {
            void import("@/src/pending-attachments").then(
              ({ clearPendingAttachments, chatAttachmentKey }) => {
                clearPendingAttachments(chatAttachmentKey(activeChatId));
              },
            );
          } else {
            const detail = store.snapshot.error?.message?.trim();
            setSendError({
              store,
              message: detail
                ? `Delivery not confirmed: ${detail}`
                : "Delivery not confirmed. Check this chat before sending again.",
            });
          }
        } catch (cause) {
          if (
            (isEveSessionInactive(cause) ||
              isEveSessionInactive(store.snapshot.error)) &&
            recoverDeadSession(store)
          ) {
            try {
              const delivery = await store.send(sendPayload);
              if (shouldRestoreUnsentDraft(store.snapshot.error, wasSendPrepared(store))) {
                throw new Error("Pending message was not saved.");
              }
              const accepted =
                Boolean(delivery?.deliveryId) ||
                hasConfirmedSend(store.snapshot.events, preview);
              setLocalSends((current) => {
                if (current.get(store)?.preview !== preview.preview) return current;
                const next = new Map(current);
                if (accepted) next.delete(store);
                else next.set(store, { ...preview, phase: "uncertain" });
                return next;
              });
              if (accepted) {
                void import("@/src/pending-attachments").then(
                  ({ clearPendingAttachments, chatAttachmentKey }) => {
                    clearPendingAttachments(chatAttachmentKey(activeChatId));
                  },
                );
                return;
              }
            } catch {
              // Fall through to the normal uncertain-delivery path.
            }
          }
          if (!wasSendPrepared(store)) {
            setLocalSends((current) => {
              if (current.get(store)?.preview !== preview.preview) return current;
              const next = new Map(current);
              next.delete(store);
              return next;
            });
            const reason = "Could not save the message before sending. Your draft is still here.";
            setSendError({ store, message: reason });
            throw new MessageNotSentError(reason);
          }
          // After the durable mark, only delivery.consumed proves acceptance.
          // A transport error without it is ambiguous; never resend automatically.
          const accepted = hasConfirmedSend(store.snapshot.events, preview);
          setLocalSends((current) => {
            if (current.get(store)?.preview !== preview.preview) return current;
            const next = new Map(current);
            if (accepted) next.delete(store);
            else next.set(store, { ...preview, phase: "uncertain" });
            return next;
          });
          const detail =
            (cause instanceof Error && cause.message.trim()) ||
            store.snapshot.error?.message?.trim();
          if (!accepted && detail) {
            setSendError({ store, message: `Delivery not confirmed: ${detail}` });
          }
          throw cause;
        }
      },
      onCancel: async () => {
        await store.cancel();
      },
      onRespondToToolApproval: async (response: { approvalId: string; optionId?: string; approved?: boolean; text?: string }) => {
        const hasDecision =
          response.optionId !== undefined || response.approved !== undefined;
        const optionId = hasDecision
          ? (response.optionId ??
            (response.approved ? "approve" : "cancel"))
          : undefined;
        await store.send({
          answers: [
            {
              interactionId: response.approvalId,
              ...(optionId !== undefined ? { optionId } : {}),
              ...(response.text !== undefined ? { text: response.text } : {}),
            },
          ],
          clientContext: buildTurnClientContext(activeProjectId),
        });
      },
    }),
    // state and status change with the store's own updates; the adapter is
    // rebuilt whenever they change so the runtime re-syncs.
    [
      store,
      projectedMessages,
      status,
      isBusy,
      waitingForAction,
      wasSendPrepared,
      localSend,
      pendingMessage,
      activeChatId,
      activeProjectId,
      ensureProjectForPlanMode,
      setActiveProjectId,
    ],
  );

  // Carry out (and similar) creates a chat with a durable pending marker but no
  // eve receive yet. Auto-send once when the thread is empty — never retry
  // when a session/history already exists (re-open must load, not resend).
  useEffect(() => {
    if (!pendingMessage || !activeChatId) return;
    if (status === "busy" || status === "resuming") {
      return;
    }
    const { events, session, messages } = store.snapshot;
    if (events.length > 0 || messages.length > 0 || session) {
      return;
    }
    if (autoSentPendingFor.current === activeChatId) return;
    autoSentPendingFor.current = activeChatId;
    void store.send({
      message: pendingMessage,
      clientContext: buildTurnClientContext(activeProjectId),
    });
  }, [pendingMessage, activeChatId, status, store, activeProjectId]);

  const runtime = useExternalStoreRuntime(adapter);
  const hasLoadedHistory =
    store.snapshot.events.length > 0 ||
    store.snapshot.messages.length > 0 ||
    Boolean(store.snapshot.session);
  const notice = sendError?.store === store
    ? { text: sendError.message }
    : persistenceError
      ? { text: "Could not save this chat.", actionLabel: "Retry save", onAction: () => void retrySync() }
      : pendingMessage && !localSend && !hasLoadedHistory
        ? { text: "Delivery not confirmed. Check this chat before sending again." }
        : hasError && !localSend
          ? { text: "Connection interrupted. Check this chat before sending again." }
          : null;

  return (
    <SafeAreaView style={screenStyle} edges={["left", "right"]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: activeTitle,
          headerBackButtonDisplayMode: "minimal",
          headerTitle: () => (
            <ChatFilesSegment
              value={mainTab}
              onChange={setMainTab}
              computerBadge={tabs.length > 0 && mainTab === "chat"}
            />
          ),
          // Thread content draws under the bar and pads itself so the first
          // message rests below the nav; scrolling can fade under it.
          headerTransparent: Platform.OS === "ios",
          headerStyle: Platform.OS === "web" ? { backgroundColor } : undefined,
          // Native needs this too — without it the system back item can flash
          // the default (light) tint for a frame on push.
          headerTintColor: foregroundColor,
          headerTitleStyle:
            Platform.OS === "web" ? { color: foregroundColor } : undefined,
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="ellipsis"
          accessibilityLabel="Thread actions"
          hidden={projectedMessages.length === 0}
          onPress={openThreadActions}
          tintColor={foregroundColor}
        />
      </Stack.Toolbar>
      <View style={{ flex: 1 }}>
        <AssistantRuntimeProvider runtime={runtime}>
          <EveAuthorization />
          {mainTab === "computer" ? (
            <ComputerPanel
              topInset={computerTopInset}
              visible={mainTab === "computer"}
            />
          ) : (
            <Thread
              autoFocus={
                Platform.OS === "ios" &&
                activeChatId === null &&
                chromeRevealed
              }
              chromeRevealed={chromeRevealed}
              conversationId={activeChatId}
              focusNewChatKey={newChatEntry}
              notice={notice}
              waitingAction={
                pendingApprovals[0]
                  ? {
                      kind: pendingApprovals[0].kind,
                      title:
                        pendingApprovals[0].kind === "question"
                          ? "The agent is paused until you answer."
                          : "The agent is paused until you respond.",
                      prompt: pendingApprovals[0].prompt,
                      detail: pendingApprovals[0].detail,
                      options: pendingApprovals[0].options,
                      allowFreeform: pendingApprovals[0].allowFreeform,
                      onRespond: async (response) => {
                        const pending = pendingApprovals[0]!;
                        await store.send({
                          answers: [
                            {
                              interactionId: pending.requestId,
                              ...(response.optionId
                                ? { optionId: response.optionId }
                                : {}),
                              ...(response.text !== undefined
                                ? { text: response.text }
                                : {}),
                            },
                          ],
                          clientContext: buildTurnClientContext(activeProjectId),
                        });
                      },
                    }
                  : waitingForAction
                    ? {
                        kind: "authorization" as const,
                        title:
                          "The agent is paused on a question or approval above — reply to continue.",
                      }
                    : null
              }
            />
          )}
        </AssistantRuntimeProvider>
        <ThreadActionsDrawer
          open={actionsOpen}
          title={activeTitle}
          canDelete={Boolean(activeChatId)}
          onClose={() => setActionsOpen(false)}
          onOpenCost={() => {
            setActionsOpen(false);
            openCost();
          }}
          onDelete={() => {
            setActionsOpen(false);
            confirmDelete();
          }}
        />
        <ThreadCostDrawer open={costOpen} onClose={() => setCostOpen(false)} />
        <ProjectPickerModal
          open={projectPickerOpen}
          onClose={() => {
            setProjectPickerOpen(false);
            const waiter = projectPickWaiter.current;
            projectPickWaiter.current = null;
            waiter?.reject(new Error("Project picker closed."));
          }}
          onSelect={(project) => {
            setActiveProjectId(project.id);
            const waiter = projectPickWaiter.current;
            projectPickWaiter.current = null;
            waiter?.resolve(project.id);
          }}
        />
      </View>
    </SafeAreaView>
  );
}
