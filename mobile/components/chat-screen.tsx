import { useMemo, useSyncExternalStore } from "react";
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Stack, router } from "expo-router";
import { ListIcon } from "lucide-react-native";
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { getModelSelection } from "@/src/model-selection";
import { useChats } from "@/src/chat-context";
import { toThreadMessages, type SpikeState } from "@/src/eve-transport";

/**
 * The chat screen: the assistant-ui native Thread wired to the eve session
 * protocol through the external-store runtime bridge. History is a separate
 * screen so navigation does not interfere with the active stream.
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
  const { store, activeTitle, persistenceError, retrySync, pendingMessage } = useChats();
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
        const text = message.content
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("\n");
        // The picker's selection rides each send as ephemeral clientContext;
        // the agent's step.started resolver maps it to the gateway model.
        await store.send({
          message: text,
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
        headerRight: () => (
          <Pressable
            onPress={() => router.push("/history")}
            className="h-11 w-11 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Open history"
          >
            <ListIcon className="size-5 text-foreground" />
          </Pressable>
        ),
      }} />
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
            Message may not have sent: {pendingMessage}. Check the conversation before resending.
          </Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <AssistantRuntimeProvider runtime={runtime}>
          <Thread autoFocus={false} />
        </AssistantRuntimeProvider>
      </View>
    </SafeAreaView>
  );
}
