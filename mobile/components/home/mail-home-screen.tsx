import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, Platform, Pressable, View } from "react-native";
import { Stack, router, useFocusEffect } from "expo-router";
import { PlusIcon, UserIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import {
  HistoryScreen,
  type HistoryChatActionHandlers,
} from "@/components/home/app-drawer";
import {
  HomeCategoryPills,
  type HomeCategory,
} from "@/components/home/home-category-pills";
import { HOME_DOCK_CLEARANCE, HomeDock } from "@/components/home/home-dock";
import { HistorySearchScreen } from "@/components/home/history-search-screen";
import {
  IssuesScreen,
  type IssuesScreenHandle,
} from "@/components/home/issues-screen";
import { ProjectPickerModal } from "@/components/project-picker-modal";
import {
  ProjectsScreen,
  type ProjectsScreenHandle,
} from "@/components/home/projects-screen";
import { ThreadCostDrawer } from "@/components/thread-cost-drawer";
import { dismissKeyboard } from "@/components/dismiss-keyboard";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useChats } from "@/src/chat-context";
import type { ChatListItem } from "@/src/chats-client";

const HOME_PRESENCE_POLL_MS = 5_000;
const IS_IOS = Platform.OS === "ios";
/** Native bottom toolbar owns inset on iOS; Android uses the floating dock. */
const LIST_BOTTOM_INSET = IS_IOS ? 0 : HOME_DOCK_CLEARANCE;

/**
 * Mail-style home: stack Profile control, category pills below, list + dock.
 */
export function MailHomeScreen() {
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
    reloadChats,
  } = useChats();

  const [category, setCategory] = useState<HomeCategory>("chats");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [costOpen, setCostOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [projectTargetId, setProjectTargetId] = useState<string | null>(null);
  const homeFocusedRef = useRef(false);
  const tasksRef = useRef<IssuesScreenHandle>(null);
  const projectsRef = useRef<ProjectsScreenHandle>(null);

  useFocusEffect(
    useCallback(() => {
      homeFocusedRef.current = true;
      void reloadChats();
      const timer = setInterval(() => {
        if (AppState.currentState !== "active") return;
        void reloadChats();
      }, HOME_PRESENCE_POLL_MS);
      return () => {
        homeFocusedRef.current = false;
        clearInterval(timer);
      };
    }, [reloadChats]),
  );

  useEffect(() => {
    const onChange = (next: string) => {
      if (next === "active" && homeFocusedRef.current) {
        void reloadChats();
      }
    };
    const subscription = AppState.addEventListener("change", onChange);
    return () => subscription.remove();
  }, [reloadChats]);

  const openChat = useCallback(() => {
    router.push("/chat");
  }, []);

  const handleNewChat = useCallback(() => {
    // Drop any home search keyboard before the push so it cannot hand off
    // into the chat transition.
    dismissKeyboard();
    newChat();
    router.push("/chat");
  }, [newChat]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
  }, []);

  const handleCompose = useCallback(() => {
    if (category === "tasks") {
      tasksRef.current?.openComposer();
      return;
    }
    if (category === "projects") {
      projectsRef.current?.openComposer();
      return;
    }
    handleNewChat();
  }, [category, handleNewChat]);

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
      Alert.alert("Delete thread?", "This cannot be undone.", [
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
      ]);
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

  const showCategoryCreate =
    !searchOpen && (category === "tasks" || category === "projects");

  const openCategoryCreate = useCallback(() => {
    if (category === "tasks") tasksRef.current?.openComposer();
    else if (category === "projects") projectsRef.current?.openComposer();
  }, [category]);

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <Stack.Screen
        options={{
          // iOS: keep header up so Stack.SearchBar / bottom SearchBarSlot stay live.
          headerShown: IS_IOS ? true : !searchOpen,
          title: "",
          headerShadowVisible: false,
          headerTransparent: false,
          headerTintColor: foregroundColor,
          headerStyle: { backgroundColor },
          // iOS: Stack.Toolbar owns the morphing Profile control — leave
          // headerLeft unset so we don't get a second chrome button.
          headerLeft: IS_IOS
            ? undefined
            : () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Profile"
                  className="h-10 w-10 items-center justify-center"
                  onPress={() => router.push("/settings")}
                >
                  <Icon as={UserIcon} className="size-5 text-foreground" />
                </Pressable>
              ),
          headerRight:
            IS_IOS || !showCategoryCreate
              ? undefined
              : () => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      category === "tasks" ? "New task" : "New project"
                    }
                    className="h-10 w-10 items-center justify-center"
                    onPress={openCategoryCreate}
                  >
                    <Icon as={PlusIcon} className="size-5 text-foreground" />
                  </Pressable>
                ),
        }}
      />
      {/* Keep mounted while blurred so Profile morphs into chat/settings. */}
      {IS_IOS && !searchOpen ? (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            icon="person"
            accessibilityLabel="Profile"
            onPress={() => router.push("/settings")}
          />
        </Stack.Toolbar>
      ) : null}
      {IS_IOS && !searchOpen && showCategoryCreate ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="plus"
            accessibilityLabel={
              category === "tasks" ? "New task" : "New project"
            }
            onPress={openCategoryCreate}
          />
        </Stack.Toolbar>
      ) : null}

      {!searchOpen ? (
        <View
          style={{
            zIndex: 2,
            backgroundColor,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <HomeCategoryPills value={category} onChange={setCategory} />
          </View>
          {__DEV__ ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thread samples"
              hitSlop={8}
              className="rounded-full bg-muted px-3 py-2 active:opacity-70"
              onPress={() => router.push("/thread-samples")}
            >
              <Text variant="secondary" weight="medium" tone="default">
                Samples
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View
        style={{ flex: 1, zIndex: 0, overflow: "hidden" }}
        accessibilityElementsHidden={searchOpen}
      >
        {category === "chats" ? (
          <HistoryScreen
            onOpenChat={openChat}
            chatActions={chatActions}
            visible={!searchOpen}
            bottomInset={LIST_BOTTOM_INSET}
          />
        ) : null}
        {category === "tasks" ? (
          <IssuesScreen ref={tasksRef} bottomInset={LIST_BOTTOM_INSET} />
        ) : null}
        {category === "projects" ? (
          <ProjectsScreen ref={projectsRef} bottomInset={LIST_BOTTOM_INSET} />
        ) : null}
      </View>

      <HistorySearchScreen
        visible={searchOpen}
        query={searchQuery}
        onClose={closeSearch}
        onOpenChat={() => {
          router.push("/chat");
        }}
      />

      {IS_IOS ? (
        <Stack.SearchBar
          placeholder="Search"
          hideWhenScrolling
          onChangeText={(event) => {
            setSearchQuery(event.nativeEvent.text);
          }}
          onFocus={() => setSearchOpen(true)}
          onOpen={() => setSearchOpen(true)}
          onCancelButtonPress={closeSearch}
          onClose={closeSearch}
        />
      ) : null}
      {IS_IOS ? (
        <Stack.Toolbar placement="bottom">
          {/* Wide search: no separateBackground on the slot (that forces
              compact integratedButton). Fixed-width Spacer — a flexible
              Spacer steals the width — plus compose separateBackground. */}
          <Stack.Toolbar.SearchBarSlot />
          <Stack.Toolbar.Spacer width={10} sharesBackground={false} />
          <Stack.Toolbar.Button
            icon="square.and.pencil"
            separateBackground
            accessibilityLabel={
              category === "tasks"
                ? "New task"
                : category === "projects"
                  ? "New project"
                  : "New chat"
            }
            onPress={handleCompose}
          />
        </Stack.Toolbar>
      ) : (
        <HomeDock
          searchActive={searchOpen}
          searchValue={searchQuery}
          onSearchChangeText={setSearchQuery}
          onSearchActivate={() => setSearchOpen(true)}
          onSearchClose={closeSearch}
          onCompose={handleCompose}
        />
      )}

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
