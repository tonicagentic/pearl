import { useCallback, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Keyboard, Platform, Pressable, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { runOnJS, type SharedValue } from "react-native-reanimated";
import { Stack, router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import ReanimatedDrawerLayout, {
  DrawerKeyboardDismissMode,
  DrawerPosition,
  DrawerType,
  type DrawerLayoutMethods,
} from "react-native-gesture-handler/ReanimatedDrawerLayout";
import { ListIcon, SquarePenIcon } from "lucide-react-native";
import {
  AssistantRuntimeProvider,
  MessageNotSentError,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { HistoryScreen, type SidebarDestination } from "@/components/app-drawer";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { EveAuthorization } from "@/components/assistant-ui/elements/authorization";
import { FloatingChatNavigation } from "@/components/floating-chat-navigation";
import { getModelSelection } from "@/src/model-selection";
import { withPendingAssistant } from "@/src/stream-presentation";
import {
  getPendingApprovals,
  hasPendingAction,
} from "@/src/message-projection";
import { createAttachmentMarker, toEveTurn } from "@/src/attachment-content";
import { createLocalSend, hasConfirmedSend, hasUnresolvedSend, projectSendMessages, shouldRestoreUnsentDraft, type LocalSend } from "@/src/send-feedback";
import { useChats } from "@/src/chat-context";
import { toThreadMessages, type SpikeState } from "@/src/eve-transport";

/**
 * The chat screen: the assistant-ui native Thread wired to the eve session
 * protocol through the external-store runtime bridge. The history panel slides
 * over the mounted thread without interrupting its stream.
 */
export function ChatScreen() {
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
  const { store, activeChatId, newChatEntry, activeTitle, persistenceError, retrySync, pendingMessage, newChat, wasSendPrepared } = useChats();
  const { width } = useWindowDimensions();
  const drawerRef = useRef<DrawerLayoutMethods>(null);
  const settledOpen = useRef(false);
  const pendingDestination = useRef<SidebarDestination | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // A new chat chosen from History should focus only after the drawer settles.
  const [drawerFocusEntry, setDrawerFocusEntry] = useState(newChatEntry);
  const closeHistory = useCallback(() => drawerRef.current?.closeDrawer(), []);
  const openHistory = useCallback(() => {
    Keyboard.dismiss();
    drawerRef.current?.openDrawer();
  }, []);
  const navigateFromHistory = useCallback((href: SidebarDestination) => {
    pendingDestination.current = href;
    closeHistory();
  }, [closeHistory]);
  const onDrawerSettled = useCallback((open: boolean) => {
    if (settledOpen.current === open) return;
    settledOpen.current = open;
    if (open) setDrawerFocusEntry(newChatEntry);
    setDrawerOpen(open);
    // A single tick at the end of the spring, not on every drag frame.
    void Haptics.selectionAsync().catch(() => {});
    if (!open && pendingDestination.current) {
      const href = pendingDestination.current;
      pendingDestination.current = null;
      router.push(href);
    }
  }, [newChatEntry]);
  const renderHistory = useCallback(
    (progress: SharedValue<number>) => (
      <HistoryScreen
        onClose={closeHistory}
        onNavigate={navigateFromHistory}
        visible={drawerOpen}
        progress={progress}
      />
    ),
    [closeHistory, navigateFromHistory, drawerOpen],
  );
  const [sendError, setSendError] = useState<{ store: object; message: string } | null>(null);
  const [localSends, setLocalSends] = useState<Map<object, LocalSend>>(() => new Map());
  const localSend = localSends.get(store) ?? null;
  const state = useSyncExternalStore<SpikeState>(
    (cb) => store.subscribe(cb),
    () => store.snapshot.data,
  );
  const status = useSyncExternalStore<string>(
    (cb) => store.subscribe(cb),
    () => store.snapshot.status,
  );
  const events = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.snapshot.events,
  );
  const confirmed = localSend ? hasConfirmedSend(events, localSend) : false;
  const waitingForAction = hasPendingAction(state);
  const pendingApprovals = useMemo(() => getPendingApprovals(state), [state]);
  const projectedMessages = useMemo(
    () => withPendingAssistant(
      projectSendMessages(
        toThreadMessages(state, { isRunning: status === "streaming", hasError: status === "error" }),
        state.messages,
        confirmed ? null : status === "error" && localSend
          ? { ...localSend, phase: "uncertain" }
          : localSend,
      ),
      state.messages,
      status === "streaming",
      Boolean(localSend && localSend.phase === "preparing" && !confirmed),
    ),
    [state, localSend, confirmed, status],
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
      isRunning: status === "streaming",
      isDisabled: status === "resuming" || status === "submitted",
      isSendDisabled: waitingForAction,
      onNew: async (message: AppendMessage) => {
        setSendError(null);
        if (waitingForAction) throw new MessageNotSentError("This chat is waiting for authorization or approval.");
        if (hasUnresolvedSend(store.snapshot.events, localSend, pendingMessage)) {
          const reason = "Check the previous message in this chat before sending another.";
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
          store.snapshot.data.messages.length,
          store.snapshot.events.length,
          message,
        );
        setLocalSends((current) => new Map(current).set(store, preview));
        // Light tick as the bubble appears; skip validation failures above.
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        try {
          // Model selection is ephemeral context on the turn, not persisted UI state.
          await store.send({
            message: outgoing,
            clientContext: { eveModelSelection: getModelSelection() },
          });
          // Eve reports prepareSend failures through status/onError, not by
          // rejecting send(). Nothing went to Eve if the durable mark failed.
          if (shouldRestoreUnsentDraft(store.snapshot.status, wasSendPrepared(store))) {
            throw new Error("Pending message was not saved.");
          }
          const accepted = hasConfirmedSend(store.snapshot.events, preview);
          setLocalSends((current) => {
            if (current.get(store)?.preview !== preview.preview) return current;
            const next = new Map(current);
            if (accepted) next.delete(store);
            else next.set(store, { ...preview, phase: "uncertain" });
            return next;
          });
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
          // After the durable mark, only Eve's receive event proves acceptance.
          // A transport error without it is ambiguous; never resend automatically.
          const accepted = hasConfirmedSend(store.snapshot.events, preview);
          setLocalSends((current) => {
            if (current.get(store)?.preview !== preview.preview) return current;
            const next = new Map(current);
            if (accepted) next.delete(store);
            else next.set(store, { ...preview, phase: "uncertain" });
            return next;
          });
          throw cause;
        }
      },
      onCancel: async () => {
        await store.cancel();
      },
      onRespondToToolApproval: async (response: { approvalId: string; optionId?: string; approved?: boolean; text?: string }) => {
        const requestId = response.approvalId;
        const optionId =
          response.optionId ??
          (response.approved ? "approve" : "cancel");
        await store.send({
          inputResponses: [
            {
              requestId,
              optionId,
              ...(response.text ? { text: response.text } : {}),
            },
          ],
          clientContext: { eveModelSelection: getModelSelection() },
        });
      },
    }),
    // state and status change with the store's own updates; the adapter is
    // rebuilt whenever they change so the runtime re-syncs.
    [store, projectedMessages, status, waitingForAction, wasSendPrepared, localSend, pendingMessage],
  );

  const runtime = useExternalStoreRuntime(adapter);
  const notice = sendError?.store === store
    ? { text: sendError.message }
    : persistenceError
      ? { text: "Could not save this chat.", actionLabel: "Retry save", onAction: () => void retrySync() }
      : pendingMessage && !localSend
        ? { text: "Delivery not confirmed. Check this chat before sending again." }
        : status === "error" && !localSend
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
            accessibilityLabel={drawerOpen ? "Close history" : "Open history"}
            accessibilityState={{ expanded: drawerOpen }}
          >
            <ListIcon className="size-5 text-foreground" />
          </Pressable>
        ),
        headerRight: () => (
          <Pressable
            onPress={newChat}
            disabled={drawerOpen}
            className="h-11 w-11 items-center justify-center disabled:opacity-40"
            accessibilityRole="button"
            accessibilityLabel="New chat"
            accessibilityState={{ disabled: drawerOpen }}
          >
            <SquarePenIcon className="size-5 text-foreground" />
          </Pressable>
        ),
      }} />
      <ReanimatedDrawerLayout
        ref={drawerRef}
        // Full-width front panel: covers chat completely; drag tracks open/close.
        drawerWidth={width}
        drawerPosition={DrawerPosition.LEFT}
        drawerType={DrawerType.FRONT}
        drawerBackgroundColor={backgroundColor}
        overlayColor="transparent"
        // Narrow edge strip for interactive open; anywhere-open is handled below.
        // A full-width edgeWidth would steal vertical pans from the transcript.
        edgeWidth={Platform.OS === "ios" ? 48 : 32}
        minSwipeDistance={12}
        keyboardDismissMode={DrawerKeyboardDismissMode.ON_DRAG}
        renderNavigationView={renderHistory}
        onDrawerOpen={() => onDrawerSettled(true)}
        onDrawerClose={() => onDrawerSettled(false)}
      >
        {() => (
          <SwipeOpenSurface swipeOpenEnabled={!drawerOpen} onSwipeOpen={openHistory}>
            <View style={{ flex: 1 }} accessibilityElementsHidden={drawerOpen}>
              <AssistantRuntimeProvider runtime={runtime}>
                <EveAuthorization />
                <Thread
                  autoFocus={Platform.OS === "ios" && activeChatId === null && !drawerOpen}
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
                              inputResponses: [
                                {
                                  requestId: pendingApprovals[0]!.requestId,
                                  optionId,
                                },
                              ],
                              clientContext: {
                                eveModelSelection: getModelSelection(),
                              },
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
              {Platform.OS === "ios" ? (
                <FloatingChatNavigation
                  title={activeTitle}
                  hasMessages={projectedMessages.length > 0}
                  onOpenHistory={openHistory}
                  onNewChat={newChat}
                  disabled={drawerOpen}
                />
              ) : null}
            </View>
          </SwipeOpenSurface>
        )}
      </ReanimatedDrawerLayout>
    </SafeAreaView>
  );
}

/** Horizontal swipe opens the history panel without stealing vertical scroll. */
function SwipeOpenSurface({
  swipeOpenEnabled,
  onSwipeOpen,
  children,
}: {
  swipeOpenEnabled: boolean;
  onSwipeOpen: () => void;
  children: ReactNode;
}) {
  const openFromAnywhere = useMemo(
    () =>
      Gesture.Pan()
        .enabled(swipeOpenEnabled)
        .activeOffsetX(24)
        .failOffsetY([-16, 16])
        .onEnd((event) => {
          "worklet";
          if (event.translationX > 56 || (event.translationX > 28 && event.velocityX > 450)) {
            runOnJS(onSwipeOpen)();
          }
        }),
    [swipeOpenEnabled, onSwipeOpen],
  );

  return (
    <GestureDetector gesture={openFromAnywhere}>
      <View style={{ flex: 1 }}>{children}</View>
    </GestureDetector>
  );
}
