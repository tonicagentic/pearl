import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import Animated, {
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { Stack, router } from "expo-router";
import * as Haptics from "expo-haptics";
import { GestureDetector } from "react-native-gesture-handler";
import { EllipsisIcon, HouseIcon, SquarePenIcon } from "lucide-react-native";
import {
  AssistantRuntimeProvider,
  MessageNotSentError,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable, useUniwind } from "uniwind";

import { HistoryScreen, type SidebarDestination } from "@/components/app-drawer";
import { Icon } from "@/components/ui/icon";
import {
  animateChatHistoryPush,
  useChatHistoryPushGesture,
  useChatHistoryPushSettle,
  useChatHistoryRevealThread,
} from "@/components/chat-history-push";
import { dismissKeyboard } from "@/components/dismiss-keyboard";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { EveAuthorization } from "@/components/assistant-ui/elements/authorization";
import { FloatingChatNavigation } from "@/components/floating-chat-navigation";
import { ThreadCostDrawer } from "@/components/thread-cost-drawer";
import { WorkspaceScreen } from "@/components/workspace-screen";
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

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);
/** Peak blur while scrubbing between recents and the thread. */
const PUSH_BLUR_MAX = 48;

/**
 * The chat screen: the assistant-ui native Thread wired to the eve session
 * protocol through the external-store runtime bridge. History and chat push
 * each other with a finger-tracked horizontal progress value.
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
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as string | undefined;
  const screenStyle: StyleProp<ViewStyle> = [
    { flex: 1 },
    { backgroundColor },
  ];
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
    newChat,
    deleteChat,
    wasSendPrepared,
  } = useChats();
  const { setChatId } = useWorkspace();
  const { width } = useWindowDimensions();

  useEffect(() => {
    setChatId(activeChatId);
  }, [activeChatId, setChatId]);

  // 0 = chat full screen, 1 = history full screen; tracks the finger while dragging.
  const openProgress = useSharedValue(0);
  const dragStartProgress = useSharedValue(0);
  const settling = useSharedValue(false);
  const settledOpen = useRef(false);
  const projectPickWaiter = useRef<{
    resolve: (projectId: string) => void;
    reject: (reason?: unknown) => void;
  } | null>(null);
  const autoSentPendingFor = useRef<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  // A new chat chosen from History should focus only after the drawer settles.
  const [drawerFocusEntry, setDrawerFocusEntry] = useState(newChatEntry);

  const ensureProjectForPlanMode = useCallback(async (): Promise<string | null> => {
    if (getAgentMode() !== "plan") return activeProjectId;
    if (activeProjectId) return activeProjectId;
    return new Promise<string>((resolve, reject) => {
      projectPickWaiter.current = { resolve, reject };
      setProjectPickerOpen(true);
    });
  }, [activeProjectId]);

  const onDrawerSettled = useCallback((open: boolean) => {
    settling.value = false;
    if (settledOpen.current === open) return;
    settledOpen.current = open;
    if (open) setDrawerFocusEntry(newChatEntry);
    setDrawerOpen(open);
  }, [newChatEntry, settling]);

  const settleRef = useRef(onDrawerSettled);
  settleRef.current = onDrawerSettled;
  const settleFromGesture = useCallback((open: boolean) => {
    settleRef.current(open);
  }, []);
  useChatHistoryPushSettle(settleFromGesture);

  const animateTo = useCallback((open: boolean) => {
    animateChatHistoryPush(openProgress, settling, open);
  }, [openProgress, settling]);

  const closeHistory = useCallback(() => {
    if (settledOpen.current === false && openProgress.value < 0.01) return;
    animateTo(false);
  }, [animateTo, openProgress]);

  const openHistory = useCallback(() => {
    dismissKeyboard();
    animateTo(true);
  }, [animateTo]);

  // Project chats / notification taps replace onto `/` while the panel may
  // still be open underneath — snap closed so they land on the thread.
  const revealThread = useCallback(() => {
    if (settledOpen.current === false && openProgress.value < 0.01) return;
    settling.value = false;
    openProgress.value = 0;
    settledOpen.current = false;
    setDrawerOpen(false);
  }, [openProgress, settling]);
  useChatHistoryRevealThread(revealThread);

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
    const canDelete = Boolean(activeChatId);
    if (Platform.OS === "ios") {
      const options = canDelete
        ? ["Cost", "Delete", "Cancel"]
        : ["Cost", "Cancel"];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: activeTitle === "New chat" ? undefined : activeTitle,
          options,
          cancelButtonIndex: options.length - 1,
          destructiveButtonIndex: canDelete ? 1 : undefined,
        },
        (index) => {
          if (index === 0) openCost();
          if (canDelete && index === 1) confirmDelete();
        },
      );
      return;
    }

    Alert.alert(
      activeTitle === "New chat" ? "Thread" : activeTitle,
      undefined,
      [
        { text: "Cost", onPress: openCost },
        ...(canDelete
          ? [{ text: "Delete", style: "destructive" as const, onPress: confirmDelete }]
          : []),
        { text: "Cancel", style: "cancel" as const },
      ],
    );
  }, [activeChatId, activeTitle, confirmDelete, openCost]);

  const navigateFromHistory = useCallback((href: SidebarDestination) => {
    // Keep the history panel open underneath so Back returns to home, not
    // the thread. Settings (form sheet) already covered the open panel.
    router.push(href);
  }, []);

  const historyStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (openProgress.value - 1) * width }],
  }));
  const chatStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: openProgress.value * width }],
  }));
  // Soft-focus each surface while it is mid-transition: the departing view
  // blurs as it leaves, the arriving view sharpens as it settles. Opacity
  // tracks intensity so a settled panel never keeps a frosted residue.
  const historyBlurProps = useAnimatedProps(() => ({
    intensity: interpolate(
      openProgress.value,
      [0, 1],
      [PUSH_BLUR_MAX, 0],
    ),
  }));
  const chatBlurProps = useAnimatedProps(() => ({
    intensity: interpolate(
      openProgress.value,
      [0, 1],
      [0, PUSH_BLUR_MAX],
    ),
  }));
  const historyBlurStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openProgress.value, [0, 1], [1, 0]),
  }));
  const chatBlurStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openProgress.value, [0, 1], [0, 1]),
  }));
  const { theme } = useUniwind();
  const blurTint = theme === "dark" ? "systemMaterialDark" : "systemMaterialLight";

  const pushGesture = useChatHistoryPushGesture({
    openProgress,
    dragStartProgress,
    settling,
    width,
  });
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
        try {
          // Mode, project, and model ride the turn as ephemeral clientContext.
          // send() resolves with a Delivery once the server accepts the turn.
          const delivery = await store.send({
            message: outgoing,
            clientContext: buildTurnClientContext(projectIdForTurn),
          });
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
          if (!accepted) {
            const detail = store.snapshot.error?.message?.trim();
            setSendError({
              store,
              message: detail
                ? `Delivery not confirmed: ${detail}`
                : "Delivery not confirmed. Check this chat before sending again.",
            });
          }
        } catch (cause) {
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
        const optionId =
          response.optionId ??
          (response.approved ? "approve" : "cancel");
        await store.send({
          answers: [
            {
              interactionId: response.approvalId,
              optionId,
              ...(response.text ? { text: response.text } : {}),
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
      activeProjectId,
      ensureProjectForPlanMode,
      setActiveProjectId,
    ],
  );

  // Carry out (and similar) creates a chat with a durable pending marker but no
  // eve receive yet. Auto-send once when the thread is empty — never retry
  // uncertain mid-send recoveries that already have stream events.
  useEffect(() => {
    if (!pendingMessage || !activeChatId) return;
    if (status === "busy" || status === "resuming") {
      return;
    }
    if (store.snapshot.events.length > 0) return;
    if (autoSentPendingFor.current === activeChatId) return;
    autoSentPendingFor.current = activeChatId;
    void store.send({
      message: pendingMessage,
      clientContext: buildTurnClientContext(activeProjectId),
    });
  }, [pendingMessage, activeChatId, status, store, activeProjectId]);

  const runtime = useExternalStoreRuntime(adapter);
  const notice = sendError?.store === store
    ? { text: sendError.message }
    : persistenceError
      ? { text: "Could not save this chat.", actionLabel: "Retry save", onAction: () => void retrySync() }
      : pendingMessage && !localSend
        ? { text: "Delivery not confirmed. Check this chat before sending again." }
        : hasError && !localSend
          ? { text: "Connection interrupted. Check this chat before sending again." }
          : null;

  return (
    <SafeAreaView style={screenStyle} edges={["left", "right"]}>
      <Stack.Screen options={{
        headerShown: Platform.OS !== "ios",
        title: activeTitle,
        headerStyle: Platform.OS === "web" ? { backgroundColor } : undefined,
        headerTintColor: Platform.OS === "web" ? foregroundColor : undefined,
        headerTitleStyle: Platform.OS === "web" ? { color: foregroundColor } : undefined,
        headerLeft: () => (
          <Pressable
            onPress={drawerOpen ? closeHistory : openHistory}
            className="h-11 w-11 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel={drawerOpen ? "Back to chat" : "Home"}
            accessibilityState={{ expanded: drawerOpen }}
          >
            <Icon as={HouseIcon} className="size-5 text-foreground" />
          </Pressable>
        ),
        headerRight: () => (
          <View className="flex-row items-center">
            {projectedMessages.length > 0 ? (
              <Pressable
                onPress={openThreadActions}
                disabled={drawerOpen}
                className="h-11 w-11 items-center justify-center disabled:opacity-40"
                accessibilityRole="button"
                accessibilityLabel="Thread actions"
                accessibilityState={{ disabled: drawerOpen }}
              >
                <Icon as={EllipsisIcon} className="size-5 text-foreground" />
              </Pressable>
            ) : null}
            <Pressable
              onPress={newChat}
              disabled={drawerOpen}
              className="h-11 w-11 items-center justify-center disabled:opacity-40"
              accessibilityRole="button"
              accessibilityLabel="New chat"
              accessibilityState={{ disabled: drawerOpen }}
            >
              <Icon as={SquarePenIcon} className="size-5 text-foreground" />
            </Pressable>
          </View>
        ),
      }} />
      <View style={{ flex: 1, overflow: "hidden" }}>
        <GestureDetector gesture={pushGesture}>
          <View style={{ flex: 1 }}>
            <Animated.View
              pointerEvents={drawerOpen ? "auto" : "none"}
              style={[
                {
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width,
                  backgroundColor,
                },
                historyStyle,
              ]}
            >
              <HistoryScreen
                onClose={closeHistory}
                onNavigate={navigateFromHistory}
                visible={drawerOpen}
                progress={openProgress}
              />
              <AnimatedBlurView
                pointerEvents="none"
                tint={blurTint}
                intensity={0}
                animatedProps={historyBlurProps}
                style={[StyleSheet.absoluteFill, historyBlurStyle]}
              />
            </Animated.View>
            <Animated.View
              style={[{ flex: 1, width, backgroundColor }, chatStyle]}
              accessibilityElementsHidden={drawerOpen}
            >
              <AssistantRuntimeProvider runtime={runtime}>
                <EveAuthorization />
                <Thread
                  autoFocus={
                    Platform.OS === "ios" &&
                    activeChatId === null &&
                    !drawerOpen &&
                    chromeRevealed
                  }
                  chromeRevealed={chromeRevealed}
                  conversationId={activeChatId}
                  focusNewChatKey={drawerOpen ? drawerFocusEntry : newChatEntry}
                  notice={notice}
                  waitingAction={
                    pendingApprovals[0]
                      ? {
                          kind: "approval" as const,
                          title: "The agent is paused until you respond.",
                          prompt: pendingApprovals[0].prompt,
                          detail: pendingApprovals[0].detail,
                          options: pendingApprovals[0].options,
                          onRespond: async (optionId) => {
                            await store.send({
                              answers: [
                                {
                                  interactionId: pendingApprovals[0]!.requestId,
                                  optionId,
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
              </AssistantRuntimeProvider>
              <AnimatedBlurView
                pointerEvents="none"
                tint={blurTint}
                intensity={0}
                animatedProps={chatBlurProps}
                style={[StyleSheet.absoluteFill, chatBlurStyle]}
              />
            </Animated.View>
          </View>
        </GestureDetector>
        {/* Outside the pan detector so menu/new-chat presses are not delayed. */}
        {Platform.OS === "ios" && chromeRevealed ? (
          <Animated.View
            pointerEvents="box-none"
            style={[StyleSheet.absoluteFill, chatStyle]}
          >
            <FloatingChatNavigation
              title={activeTitle}
              hasMessages={projectedMessages.length > 0}
              canDelete={Boolean(activeChatId)}
              onOpenHistory={openHistory}
              onNewChat={newChat}
              onOpenCost={openCost}
              onDeleteChat={performDelete}
              disabled={drawerOpen}
            />
          </Animated.View>
        ) : null}
        <ThreadCostDrawer open={costOpen} onClose={() => setCostOpen(false)} />
        <WorkspaceScreen />
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
