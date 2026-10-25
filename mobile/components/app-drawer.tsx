import { Platform, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { FlatList } from "react-native-gesture-handler";
import { InboxIcon, NetworkIcon, PlusIcon, Settings2Icon, SquarePenIcon, XIcon } from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";

/** Shared history content for the swipeable chat panel and direct-link screen. */
export type SidebarDestination = "/areas" | "/issues" | "/settings";

export function HistoryScreen({
  onClose,
  onNavigate,
  visible = true,
}: {
  onClose?: () => void;
  onNavigate?: (href: SidebarDestination) => void;
  visible?: boolean;
}) {
  const { signedIn } = useAuth();
  const { chats, activeChatId, chatsLoading, chatsError, hasMoreChats, loadMoreChats, reloadChats, selectChat, selectionError, newChat } = useChats();
  const backgroundColor = useCSSVariable("--color-background") as string | undefined;
  const insets = useSafeAreaInsets();
  const iosSidebar = Platform.OS === "ios" && !!onClose;
  // Leave room for the floating Settings / New chat circles above the home indicator.
  const iosFooterClearance = 48 + 40 + Math.max(insets.bottom, 12);

  const goToChat = () => {
    if (onClose) onClose();
    else if (router.canGoBack()) router.back();
    else router.replace("/");
  };
  const openDestination = (href: SidebarDestination) => {
    if (onNavigate) onNavigate(href);
    else {
      onClose?.();
      router.push(href);
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor }}
      edges={iosSidebar ? ["top", "left", "right"] : onClose ? ["top", "left", "right", "bottom"] : ["left", "right", "bottom"]}
      accessibilityElementsHidden={!visible}
      accessibilityActions={iosSidebar ? [{ name: "close", label: "Close sidebar" }] : undefined}
      onAccessibilityAction={iosSidebar ? (event) => {
        if (event.nativeEvent.actionName === "close") onClose?.();
      } : undefined}
    >
      {iosSidebar ? null : onClose ? (
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
        contentContainerClassName={iosSidebar ? "px-5 pt-3" : "px-4 pb-8"}
        contentContainerStyle={iosSidebar ? { paddingBottom: iosFooterClearance + 16 } : undefined}
        data={chats}
        extraData={activeChatId}
        keyExtractor={(chat) => chat.id}
        renderItem={({ item: chat }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: activeChatId === chat.id }}
            className={`${iosSidebar ? "min-h-11 rounded-xl px-2.5" : "min-h-12 rounded-lg px-3"} justify-center ${activeChatId === chat.id ? "bg-muted/50" : ""}`}
            onPress={() => { void selectChat(chat.id).then((selected) => { if (selected) goToChat(); }); }}
          >
            <Text className={iosSidebar ? "text-[17px] font-normal text-foreground" : "text-base text-foreground"} numberOfLines={1}>{chat.title}</Text>
          </Pressable>
        )}
        ListHeaderComponent={
          <>
            {iosSidebar ? (
              <>
                <Pressable accessibilityRole="button" className="min-h-11 flex-row items-center gap-3 rounded-xl px-2.5" onPress={() => openDestination("/areas")}>
                  <NetworkIcon className="size-5 text-foreground" />
                  <Text className="text-[17px] font-normal text-foreground">Areas</Text>
                </Pressable>
                <Pressable accessibilityRole="button" className="min-h-11 flex-row items-center gap-3 rounded-xl px-2.5" onPress={() => openDestination("/issues")}>
                  <InboxIcon className="size-5 text-foreground" />
                  <Text className="text-[17px] font-normal text-foreground">Issues</Text>
                </Pressable>
                <Text className="px-2.5 pb-2 pt-7 text-[15px] font-normal text-muted-foreground">Recents</Text>
              </>
            ) : (
              <>
                <Pressable accessibilityRole="button" className="min-h-12 flex-row items-center gap-3 rounded-lg px-3" onPress={() => openDestination("/settings")}>
                  <Settings2Icon className="size-5 text-foreground" />
                  <Text className="text-base text-foreground">Settings</Text>
                </Pressable>
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
              </>
            )}
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
      {iosSidebar ? (
        <View
          pointerEvents="box-none"
          className="absolute right-0 bottom-0 left-0"
          style={{ paddingBottom: Math.max(insets.bottom, 12), backgroundColor }}
        >
          <View
            pointerEvents="box-none"
            className="flex-row items-center justify-between px-5 pt-3"
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Settings"
              className="h-12 w-12 items-center justify-center rounded-full border border-border/40 bg-card active:bg-muted/60"
              onPress={() => openDestination("/settings")}
            >
              <Settings2Icon className="size-6 text-foreground" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New chat"
              className="h-12 w-12 items-center justify-center rounded-full bg-foreground active:opacity-80"
              onPress={() => { newChat(); goToChat(); }}
            >
              <SquarePenIcon className="size-6" color={backgroundColor ?? "#fff"} />
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
