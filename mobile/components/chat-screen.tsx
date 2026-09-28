import { useCallback, useMemo, useSyncExternalStore } from "react";
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useNavigation } from "expo-router";
import { MenuIcon } from "lucide-react-native";
import {
  AssistantRuntimeProvider,
  AuiConfig,
  Suggestions,
  useExternalStoreRuntime,
  type ThreadMessageLike,
} from "@assistant-ui/react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { AGENT_URL, getStore, toThreadMessages, type SpikeState } from "@/src/eve-transport";

/**
 * The chat screen: the assistant-ui native Thread wired to the eve session
 * protocol through the external-store runtime bridge. Lives inside the
 * drawer's content area; the hamburger opens the drawer.
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
  const store = getStore();
  const state = useSyncExternalStore<SpikeState>(
    (cb) => store.subscribe(cb),
    () => store.snapshot.data,
  );
  const status = useSyncExternalStore<string>(
    (cb) => store.subscribe(cb),
    () => store.snapshot.status,
  );
  const navigation = useNavigation<{ openDrawer: () => void; closeDrawer: () => void }>();

  const runtime = useExternalStoreRuntime({
    get messages(): ThreadMessageLike[] {
      return toThreadMessages(state);
    },
    // Return the projection as-is: the runtime's converter assigns stable
    // positional fallback ids (the projection omits ids on purpose) and
    // honors the per-message status it carries.
    convertMessage: (message) => message,
    isRunning: status === "streaming",
    isDisabled: false,
    onNew: async (message) => {
      const text = message.content
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("\n");
      await store.send({ message: text });
    },
    onCancel: async () => {
      await store.cancel();
    },
  });

  // Suggestions render as chips on the empty (new-chat) state, mirroring the
  // with-expo sample's root config.
  const config = useMemo(
    () =>
      AuiConfig({
        suggestions: Suggestions([
          {
            title: "What's on my plate",
            label: "right now?",
            prompt: "What's on my plate right now?",
          },
          {
            title: "Summarize my notes",
            label: "from this week",
            prompt: "Summarize what's in my notes from this week.",
          },
          {
            title: "Draft a reply",
            label: "I'm stuck on",
            prompt: "Help me write a reply I've been putting off.",
          },
        ]),
      }),
    [],
  );

  const openDrawer = useCallback(() => {
    navigation.openDrawer();
  }, [navigation]);

  return (
    <SafeAreaView style={screenStyle} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable onPress={openDrawer} hitSlop={8} accessibilityLabel="Open menu">
          <MenuIcon className="size-5 text-muted-foreground" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Pearl</Text>
          <Text style={styles.headerUrl} numberOfLines={1}>
            {status === "streaming" ? "streaming…" : AGENT_URL}
          </Text>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <AssistantRuntimeProvider runtime={runtime} config={config}>
          <Thread />
        </AssistantRuntimeProvider>
      </View>
    </SafeAreaView>
  );
}

const styles = {
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  } as const,
  headerText: { flex: 1, marginRight: 8 } as const,
  headerTitle: { fontSize: 15, fontWeight: "600" } as const,
  headerUrl: { fontSize: 10, color: "#777" } as const,
};
