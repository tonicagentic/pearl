import { useCallback, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Keyboard, Platform, Pressable, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { Stack, router } from "expo-router";
import * as Haptics from "expo-haptics";
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
import { hasPendingAction } from "@/src/message-projection";
import { createAttachmentMarker, toEveTurn } from "@/src/attachment-content";
import { createLocalSend, hasConfirmedSend, hasUnresolvedSend, projectSendMessages, shouldRestoreUnsentDraft, type LocalSend } from "@/src/send-feedback";
import { useChats } from "@/src/chat-context";
import { toThreadMessages, type SpikeState } from "@/src/eve-transport";

/**
 * The chat screen: the assistant-ui native Thread wired to the eve session
 * protocol through the external-store runtime bridge. The history drawer
 * moves the mounted thread on iOS without interrupting its stream.
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
    () => <HistoryScreen onClose={closeHistory} onNavigate={navigateFromHistory} visible={drawerOpen} />,
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
        drawerWidth={Math.min(width * (Platform.OS === "ios" ? 0.79 : 0.86), 360)}
        drawerPosition={DrawerPosition.LEFT}
        drawerType={Platform.OS === "ios" ? DrawerType.BACK : DrawerType.FRONT}
        drawerBackgroundColor={backgroundColor}
        overlayColor={Platform.OS === "ios" ? "transparent" : "rgba(0, 0, 0, 0.26)"}
        edgeWidth={32}
        minSwipeDistance={12}
        keyboardDismissMode={DrawerKeyboardDismissMode.ON_DRAG}
        renderNavigationView={renderHistory}
        onDrawerOpen={() => onDrawerSettled(true)}
        onDrawerClose={() => onDrawerSettled(false)}
      >
        {(progress) => {
          const chat = (
            <View style={{ flex: 1 }} accessibilityElementsHidden={drawerOpen}>
              <AssistantRuntimeProvider runtime={runtime}>
                <EveAuthorization />
                <Thread
                  autoFocus={Platform.OS === "ios" && activeChatId === null && !drawerOpen}
                  conversationId={activeChatId}
                  focusNewChatKey={drawerOpen ? drawerFocusEntry : newChatEntry}
                  notice={notice}
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
          );
          return Platform.OS === "ios" ? (
            <SlidingChatSurface progress={progress} backgroundColor={backgroundColor}>
              {chat}
            </SlidingChatSurface>
          ) : chat;
        }}
      </ReanimatedDrawerLayout>
    </SafeAreaView>
  );
}

function SlidingChatSurface({
  progress,
  backgroundColor,
  children,
}: {
  progress: SharedValue<number> | undefined;
  backgroundColor: string | undefined;
  children: ReactNode;
}) {
  const shape = useAnimatedStyle(() => ({
    borderTopLeftRadius: interpolate(progress?.value ?? 0, [0, 1], [0, 48]),
    borderBottomLeftRadius: interpolate(progress?.value ?? 0, [0, 1], [0, 48]),
  }));
  const shadow = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(progress?.value ?? 0, [0, 1], [0, 0.14]),
  }));

  return (
    <Animated.View style={[{ flex: 1, shadowColor: "#000", shadowOffset: { width: -8, height: 0 }, shadowRadius: 24 }, shape, shadow]}>
      <Animated.View style={[{ flex: 1, overflow: "hidden", backgroundColor }, shape]}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}
