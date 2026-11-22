import { Platform } from "react-native";
import { router } from "expo-router";

import { ChatHistoryContent } from "@/components/history/chat-history-content";
import { ScreenChrome } from "@/components/navigation/screen-chrome";
import { useStackSearch } from "@/src/use-stack-search";

/** Full chat history list (former home Recents). */
export function ChatHistoryScreen() {
  const search = useStackSearch();

  return (
    <ScreenChrome
      title="History"
      leading="drawer"
      search={{
        placeholder: "Search history",
        iosOnly: true,
        hideWhenScrolling: true,
        autoCapitalize: "none",
        onChangeText: search.onChangeText,
        onCancelButtonPress: search.onCancelButtonPress,
      }}
    >
      <ChatHistoryContent
        onOpenChat={(_chatId) => {
          router.push("/chat", { withAnchor: true });
        }}
        search={search}
        showInlineSearch={Platform.OS !== "ios"}
      />
    </ScreenChrome>
  );
}
