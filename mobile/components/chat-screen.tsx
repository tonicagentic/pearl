import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Keyboard, Pressable, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { Stack } from "expo-router";
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

import { HistoryScreen } from "@/components/app-drawer";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { getModelSelection } from "@/src/model-selection";
import { createAttachmentMarker, isAttachmentMarker, toEveTurn } from "@/src/attachment-content";
import { useChats } from "@/src/chat-context";
import { toThreadMessages, type SpikeState } from "@/src/eve-transport";

/**
 * The chat screen: the assistant-ui native Thread wired to the eve session
 * protocol through the external-store runtime bridge. The history drawer
 * overlays the mounted thread so navigation never interrupts its stream.
 */
export function ChatScreen() {
  // The safe-area container is a native codegen view, so uniwind's className
  // binding cannot reach it; paint the theme background through style instead
  // so the color extends under the status bar.
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const screenStyle: StyleProp<ViewStyle> = [
    { flex: 1 },
    { backgroundColor },
  ];
  const { store, activeTitle, persistenceError, retrySync, pendingMessage, newChat } = useChats();
  const { width } = useWindowDimensions();
  const drawerRef = useRef<DrawerLayoutMethods>(null);
  const settledOpen = useRef(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeHistory = useCallback(() => drawerRef.current?.closeDrawer(), []);
  const openHistory = useCallback(() => {
    Keyboard.dismiss();
    drawerRef.current?.openDrawer();
  }, []);
  const onDrawerSettled = useCallback((open: boolean) => {
    if (settledOpen.current === open) return;
    settledOpen.current = open;
    setDrawerOpen(open);
    // A single tick at the end of the spring, not on every drag frame.
    void Haptics.selectionAsync().catch(() => {});
  }, []);
  const renderHistory = useCallback(
    () => <HistoryScreen onClose={closeHistory} visible={drawerOpen} />,
    [closeHistory, drawerOpen],
  );
  const [attachmentError, setAttachmentError] = useState<{ store: object; message: string } | null>(null);
  const state = useSyncExternalStore<SpikeState>(
    (cb) => store.subscribe(cb),
    () => store.snapshot.data,
  );
  const status = useSyncExternalStore<string>(
    (cb) => store.subscribe(cb),
    () => store.snapshot.status,
  );

  // Rebuilt when the store instance changes (chat selection): the adapter
  // closes over the current store, and the runtime core re-syncs on the new
  // adapter object.
  const adapter = useMemo(
    () => ({
      get messages(): ThreadMessageLike[] {
        return toThreadMessages(state);
      },
      // Return the projection as-is: the runtime's converter assigns stable
      // positional fallback ids (the projection omits ids on purpose) and
      // honors the per-message status it carries.
      convertMessage: (message: ThreadMessageLike) => message,
      isRunning: status === "streaming",
      isDisabled: status === "resuming" || status === "submitted",
      onNew: async (message: AppendMessage) => {
        setAttachmentError(null);
        let turn: ReturnType<typeof toEveTurn>;
        try {
          turn = toEveTurn(message);
        } catch (cause) {
          // Only validation failures are known to have never reached eve.
          // Restore the draft and chips; network failures remain uncertain.
          const reason = cause instanceof Error ? cause.message : "Attachment is not ready.";
          setAttachmentError({ store, message: reason });
          throw new MessageNotSentError(reason);
        }
        // Match an attachment-only pending row to this exact eve receive event
        // after a force-quit. The token is just a correlation label, not auth.
        const outgoing = !turn.text.trim() && Array.isArray(turn.message)
          ? [{ type: "text" as const, text: createAttachmentMarker() }, ...turn.message]
          : turn.message;
        // The picker's selection rides each send as ephemeral clientContext;
        // the agent's step.started resolver maps it to the gateway model.
        await store.send({
          message: outgoing,
          clientContext: { eveModelSelection: getModelSelection() },
        });
      },
      onCancel: async () => {
        await store.cancel();
      },
    }),
    // state and status change with the store's own updates; the adapter is
    // rebuilt whenever they change so the runtime re-syncs.
    [store, state, status],
  );

  const runtime = useExternalStoreRuntime(adapter);


  return (
    <SafeAreaView style={screenStyle} edges={["left", "right"]}>
      <Stack.Screen options={{
        headerShown: true,
        title: activeTitle,
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
        drawerWidth={Math.min(width * 0.86, 360)}
        drawerPosition={DrawerPosition.LEFT}
        drawerType={DrawerType.FRONT}
        drawerBackgroundColor={backgroundColor}
        overlayColor="rgba(0, 0, 0, 0.26)"
        edgeWidth={32}
        minSwipeDistance={12}
        keyboardDismissMode={DrawerKeyboardDismissMode.ON_DRAG}
        renderNavigationView={renderHistory}
        onDrawerOpen={() => onDrawerSettled(true)}
        onDrawerClose={() => onDrawerSettled(false)}
      >
        <View style={{ flex: 1 }} accessibilityElementsHidden={drawerOpen}>
          {status !== "ready" ? (
            <Text className="px-4 py-1 text-xs text-muted-foreground" accessibilityRole="text">
              {status === "error" ? "Connection interrupted" : status === "resuming" ? "Reconnecting…" : "Working…"}
            </Text>
          ) : null}
          {persistenceError ? (
            <Pressable accessibilityRole="button" onPress={() => void retrySync()} className="min-h-11 justify-center bg-destructive/10 px-4">
              <Text className="text-sm text-destructive">Could not save this chat. Tap to retry.</Text>
            </Pressable>
          ) : null}
          {pendingMessage ? (
            <View className="min-h-11 justify-center bg-muted px-4" accessibilityRole="text">
              <Text className="text-sm text-foreground" numberOfLines={2}>
                Message may not have sent: {isAttachmentMarker(pendingMessage) ? "attachment" : pendingMessage}. Check the conversation before resending.
              </Text>
            </View>
          ) : null}
          {attachmentError?.store === store ? (
            <Text className="bg-destructive/10 px-4 py-2 text-sm text-destructive" accessibilityRole="alert">
              {attachmentError.message}
            </Text>
          ) : null}
          <View style={{ flex: 1 }}>
            <AssistantRuntimeProvider runtime={runtime}>
              <Thread autoFocus={false} />
            </AssistantRuntimeProvider>
          </View>
        </View>
      </ReanimatedDrawerLayout>
    </SafeAreaView>
  );
}
