import { Platform } from "react-native";
import { router, Stack } from "expo-router";
import { useCSSVariable } from "uniwind";

import { ChatHistoryContent } from "@/components/home/chat-history-content";
import { StackScreen } from "@/components/ui/stack-screen";
import { useStackSearch } from "@/src/use-stack-search";

/** Full chat history list (former home Recents). */
export function ChatHistoryScreen() {
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;
  const search = useStackSearch();

  return (
    <StackScreen>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "History",
          headerBackButtonDisplayMode: "minimal",
          headerTintColor: foregroundColor,
        }}
      />
      {Platform.OS === "ios" ? (
        <Stack.SearchBar
          placeholder="Search history"
          hideWhenScrolling
          autoCapitalize="none"
          onChangeText={search.onChangeText}
          onCancelButtonPress={search.onCancelButtonPress}
        />
      ) : null}
      <ChatHistoryContent
        onOpenChat={() => {
          router.push("/chat");
        }}
        search={search}
        showInlineSearch={Platform.OS !== "ios"}
      />
    </StackScreen>
  );
}
