import { useCallback, useMemo, useState } from "react";
import { Alert, Platform, View } from "react-native";
import { Stack, router } from "expo-router";
import { useCSSVariable } from "uniwind";

import {
  HistoryScreen,
  type HistoryChatActionHandlers,
  type SidebarDestination,
} from "@/components/app-drawer";
import { HistorySearchBar } from "@/components/history-search-bar";
import { HistorySearchScreen } from "@/components/history-search-screen";
import { ProjectPickerModal } from "@/components/project-picker-modal";
import { ThreadCostDrawer } from "@/components/thread-cost-drawer";
import { useChats } from "@/src/chat-context";
import type { ChatListItem } from "@/src/chats-client";

/**
 * Home (Stack root): recents + Projects/Tasks entry points.
 * Chat is a nested `/chat` route opened via New chat or selecting a recent.
 */
export function HistoryRouteScreen() {
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;
  const {
    newChat,
    deleteChat,
    renameChat,
    setChatProject,
    selectChat,
  } = useChats();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [costOpen, setCostOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [projectTargetId, setProjectTargetId] = useState<string | null>(null);

  const openDestination = useCallback((href: SidebarDestination) => {
    router.push(href);
  }, []);

  const openChat = useCallback(() => {
    router.push("/chat");
  }, []);

  const handleNewChat = useCallback(() => {
    newChat();
    router.push("/chat");
  }, [newChat]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
  }, []);

  const promptRename = useCallback(
    (chat: ChatListItem) => {
      if (Platform.OS === "ios" && typeof Alert.prompt === "function") {
        Alert.prompt(
          "Rename chat",
          undefined,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Save",
              onPress: (value?: string) => {
                const next = value?.trim();
                if (!next || next === chat.title) return;
                void renameChat(chat.id, next).catch(() => {
                  Alert.alert(
                    "Could not rename",
                    "Check your connection and try again.",
                  );
                });
              },
            },
          ],
          "plain-text",
          chat.title,
        );
        return;
      }
      Alert.alert("Rename", "Renaming is available on iOS.");
    },
    [renameChat],
  );

  const confirmDelete = useCallback(
    (chat: ChatListItem) => {
      Alert.alert(
        "Delete thread?",
        "This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              void deleteChat(chat.id).catch(() => {
                Alert.alert(
                  "Could not delete",
                  "Check your connection and try again.",
                );
              });
            },
          },
        ],
      );
    },
    [deleteChat],
  );

  const openCost = useCallback(
    (chat: ChatListItem) => {
      void selectChat(chat.id).then((ok) => {
        if (!ok) {
          Alert.alert(
            "Could not open cost",
            "Check your connection and try again.",
          );
          return;
        }
        setCostOpen(true);
      });
    },
    [selectChat],
  );

  const openProjectPicker = useCallback((chat: ChatListItem) => {
    setProjectTargetId(chat.id);
    setProjectPickerOpen(true);
  }, []);

  const removeFromProject = useCallback(
    (chat: ChatListItem) => {
      void setChatProject(chat.id, null).catch(() => {
        Alert.alert(
          "Could not update project",
          "Check your connection and try again.",
        );
      });
    },
    [setChatProject],
  );

  const chatActions = useMemo<HistoryChatActionHandlers>(
    () => ({
      onRename: promptRename,
      onViewCost: openCost,
      onMoveToProject: openProjectPicker,
      onRemoveFromProject: removeFromProject,
      onDelete: confirmDelete,
    }),
    [
      promptRename,
      openCost,
      openProjectPicker,
      removeFromProject,
      confirmDelete,
    ],
  );

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <Stack.Screen
        options={{
          headerShown: !searchOpen,
          title: "",
          // Content draws under the bar; HistoryScreen pads by header height.
          headerTransparent: true,
          headerShadowVisible: false,
          headerTintColor: foregroundColor,
        }}
      />
      {!searchOpen ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="square.and.pencil"
            accessibilityLabel="New chat"
            onPress={handleNewChat}
          />
        </Stack.Toolbar>
      ) : null}
      <HistoryScreen
        onOpenChat={openChat}
        onNavigate={openDestination}
        chatActions={chatActions}
        visible={!searchOpen}
      />
      <HistorySearchScreen
        visible={searchOpen}
        query={searchQuery}
        onClose={closeSearch}
        onOpenChat={() => {
          router.push("/chat");
        }}
      />
      <HistorySearchBar
        active={searchOpen}
        value={searchQuery}
        onChangeText={setSearchQuery}
        onActivate={() => setSearchOpen(true)}
        onClose={closeSearch}
      />
      <ThreadCostDrawer open={costOpen} onClose={() => setCostOpen(false)} />
      <ProjectPickerModal
        open={projectPickerOpen}
        onClose={() => {
          setProjectPickerOpen(false);
          setProjectTargetId(null);
        }}
        onSelect={(project) => {
          const chatId = projectTargetId;
          setProjectPickerOpen(false);
          setProjectTargetId(null);
          if (!chatId) return;
          void setChatProject(chatId, project.id).catch(() => {
            Alert.alert(
              "Could not update project",
              "Check your connection and try again.",
            );
          });
        }}
      />
    </View>
  );
}
