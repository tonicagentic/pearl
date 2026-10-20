import { FlatList, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { InboxIcon, NetworkIcon, PlusIcon, SettingsIcon, XIcon } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";

/** Shared history content for the swipeable chat panel and direct-link screen. */
export function HistoryScreen({
  onClose,
  visible = true,
}: {
  onClose?: () => void;
  visible?: boolean;
}) {
  const { signedIn, viewerEmail, signOut } = useAuth();
  const { chats, activeChatId, chatsLoading, chatsError, hasMoreChats, loadMoreChats, reloadChats, selectChat, selectionError, newChat } = useChats();
  const backgroundColor = useCSSVariable("--color-background") as string | undefined;

  const goToChat = () => {
    if (onClose) onClose();
    else if (router.canGoBack()) router.back();
    else router.replace("/");
  };
  const openDestination = (href: "/areas" | "/issues" | "/settings") => {
    onClose?.();
    router.push(href);
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor }}
      edges={["left", "right", "bottom"]}
      accessibilityElementsHidden={!visible}
    >
      {onClose ? (
        <View className="flex-row items-center justify-between px-4 py-2">
          <Text className="text-lg font-semibold text-foreground">History</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close history"
            className="h-11 w-11 items-center justify-center"
            onPress={onClose}
          >
            <XIcon className="size-5 text-foreground" />
          </Pressable>
        </View>
      ) : null}
      <FlatList
        className="flex-1"
        contentContainerClassName="px-4 pb-8"
        data={chats}
        extraData={activeChatId}
        keyExtractor={(chat) => chat.id}
        renderItem={({ item: chat }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: activeChatId === chat.id }}
            className={`min-h-12 justify-center rounded-lg px-3 ${activeChatId === chat.id ? "bg-muted/50" : ""}`}
            onPress={() => { void selectChat(chat.id).then((selected) => { if (selected) goToChat(); }); }}
          >
            <Text className="text-base text-foreground" numberOfLines={1}>{chat.title}</Text>
          </Pressable>
        )}
        ListHeaderComponent={
          <>
            <Pressable accessibilityRole="button" className="min-h-12 flex-row items-center gap-3 rounded-lg px-3" onPress={() => { newChat(); goToChat(); }}>
              <PlusIcon className="size-5 text-foreground" />
              <Text className="text-base text-foreground">New chat</Text>
            </Pressable>
            <Pressable accessibilityRole="button" className="min-h-12 flex-row items-center gap-3 rounded-lg px-3" onPress={() => openDestination("/areas")}>
              <NetworkIcon className="size-5 text-foreground" />
              <Text className="text-base text-foreground">Areas</Text>
            </Pressable>
            <Pressable accessibilityRole="button" className="min-h-12 flex-row items-center gap-3 rounded-lg px-3" onPress={() => openDestination("/issues")}>
              <InboxIcon className="size-5 text-foreground" />
              <Text className="text-base text-foreground">Issues</Text>
            </Pressable>
            <Text className="px-3 pb-2 pt-5 text-xs font-medium uppercase text-muted-foreground">Chats</Text>
            {selectionError ? <Text className="px-3 py-2 text-sm text-destructive" accessibilityRole="alert">{selectionError}</Text> : null}
            {chatsError ? (
              <Pressable accessibilityRole="button" className="min-h-12 justify-center px-3" onPress={() => void reloadChats()}>
                <Text className="text-sm text-destructive">{chatsError} Tap to retry.</Text>
              </Pressable>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <Text className="px-3 py-2 text-sm text-muted-foreground">
            {chatsLoading ? "Loading history…" : signedIn ? "No chats yet." : "Sign in to see your chats."}
          </Text>
        }
        ListFooterComponent={hasMoreChats ? (
          <Pressable accessibilityRole="button" className="min-h-12 justify-center rounded-lg px-3" disabled={chatsLoading} onPress={() => void loadMoreChats()}>
            <Text className="text-sm text-muted-foreground">{chatsLoading ? "Loading…" : "Load more"}</Text>
          </Pressable>
        ) : null}
      />
      <View className="border-t border-border px-4 py-2">
        {signedIn ? (
          <>
            <Text className="px-3 text-xs text-muted-foreground" numberOfLines={1}>{viewerEmail}</Text>
            <Pressable accessibilityRole="button" className="min-h-12 flex-row items-center gap-3 rounded-lg px-3" onPress={() => openDestination("/settings")}>
              <SettingsIcon className="size-5 text-foreground" />
              <Text className="text-base text-foreground">Settings</Text>
            </Pressable>
            <Pressable accessibilityRole="button" className="min-h-12 justify-center rounded-lg px-3" onPress={() => { signOut(); goToChat(); }}>
              <Text className="text-base text-muted-foreground">Sign out</Text>
            </Pressable>
          </>
        ) : <Text className="px-3 py-2 text-sm text-muted-foreground">Signed out</Text>}
      </View>
    </SafeAreaView>
  );
}
