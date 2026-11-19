import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, AppState, Platform, Pressable, View } from "react-native";
import { Stack, router, useFocusEffect } from "expo-router";
import { UserIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import {
  HistoryScreen,
  type HistoryChatActionHandlers,
} from "@/components/home/app-drawer";
import { CreateAgentModal } from "@/components/home/create-agent-modal";
import {
  HOME_COMPOSE_FAB_CLEARANCE,
  HomeComposeFab,
} from "@/components/home/home-composer-dock";
import {
  SIGN_IN_CARD_CLEARANCE,
  SignInForNewChatCard,
} from "@/components/home/sign-in-for-new-chat-card";
import { ProjectPickerModal } from "@/components/project-picker-modal";
import { BillingGateScreen } from "@/components/settings/billing-gate-screen";
import { ThreadCostDrawer } from "@/components/thread-cost-drawer";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";
import { chatListPresence } from "@/src/chat-presence";
import { getChat, type ChatListItem } from "@/src/chats-client";
import { initials as viewerInitials } from "@/src/initials";
import type { CustomAgentDto } from "@/src/custom-agents-client";
import type { ThreadTraceEvent } from "@/src/thread-trace";

const IS_IOS = Platform.OS === "ios";

/**
 * Mail-style home: Profile, bottom-right compose, Agents, Recents, and a
 * Workspaces button that opens the list screen.
 */
export function MailHomeScreen() {
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;
  const { billingReady, isAnonymous, markBillingReady, viewerEmail, viewerName } =
    useAuth();
  const profileInitials = isAnonymous
    ? null
    : viewerInitials(viewerName, viewerEmail);
  const openProfile = useCallback(() => {
    router.push(isAnonymous ? "/sign-in" : "/settings");
  }, [isAnonymous]);
  const {
    chats,
    chatsReady,
    newChat,
    deleteChat,
    renameChat,
    setChatProject,
    selectChat,
    reloadChats,
  } = useChats();

  const [costOpen, setCostOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [projectTargetId, setProjectTargetId] = useState<string | null>(null);
  const [createAgentOpen, setCreateAgentOpen] = useState(false);
  const homeFocusedRef = useRef(false);
  // Cold-start once: open new chat by default, or home when something is unread.
  const didLaunchRef = useRef(false);
  const [holdingLaunchHome, setHoldingLaunchHome] = useState(true);

  useFocusEffect(
    useCallback(() => {
      homeFocusedRef.current = true;
      void reloadChats({ silent: true });
      return () => {
        homeFocusedRef.current = false;
      };
    }, [reloadChats]),
  );

  useEffect(() => {
    const onChange = (next: string) => {
      if (next === "active" && homeFocusedRef.current) {
        void reloadChats({ silent: true });
      }
    };
    const subscription = AppState.addEventListener("change", onChange);
    return () => subscription.remove();
  }, [reloadChats]);

  const openChat = useCallback(() => {
    router.push("/chat");
  }, []);

  const guestHasThread = isAnonymous && chats.length > 0;
  const listBottomInset = guestHasThread
    ? SIGN_IN_CARD_CLEARANCE
    : HOME_COMPOSE_FAB_CLEARANCE;

  const openNewChat = useCallback(() => {
    if (!billingReady) return;
    // Guests get a single thread. Ask Pearl reopens it instead of starting another.
    const existing = isAnonymous ? chats[0] : undefined;
    if (existing) {
      void selectChat(existing.id).then((ok) => {
        if (ok) router.push("/chat");
      });
      return;
    }
    newChat();
    router.push("/chat");
  }, [billingReady, chats, isAnonymous, newChat, selectChat]);

  const openCreateAgent = useCallback(() => {
    if (!billingReady || isAnonymous) return;
    setCreateAgentOpen(true);
  }, [billingReady, isAnonymous]);

  const onAgentCreated = useCallback(
    (agent: CustomAgentDto) => {
      setCreateAgentOpen(false);
      void selectChat(agent.chatId).then((ok) => {
        if (ok) router.push("/chat");
      });
    },
    [selectChat],
  );

  useEffect(() => {
    if (!billingReady || !chatsReady || didLaunchRef.current) return;
    didLaunchRef.current = true;

    // Guests keep a single thread — reopen it, or start one if empty.
    if (isAnonymous) {
      const existing = chats[0];
      const open = existing
        ? selectChat(existing.id).then((ok) => ok)
        : Promise.resolve(true);
      void open.then((ok) => {
        if (!existing) newChat();
        if (ok) {
          router.push({ pathname: "/chat", params: { guestEntry: "1" } });
        }
        setHoldingLaunchHome(false);
      });
      return;
    }

    // Signed-in: land on new chat unless another thread has an unread reply.
    const hasUnread = chats.some(
      (chat) => chatListPresence(chat) === "unread",
    );
    if (hasUnread) {
      setHoldingLaunchHome(false);
      return;
    }
    newChat();
    router.push({ pathname: "/chat", params: { settle: "1" } });
    setHoldingLaunchHome(false);
  }, [
    billingReady,
    chats,
    chatsReady,
    isAnonymous,
    newChat,
    selectChat,
  ]);

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

  const [costEvents, setCostEvents] = useState<readonly ThreadTraceEvent[]>(
    [],
  );

  const openCost = useCallback((chat: ChatListItem) => {
    void getChat(chat.id)
      .then((full) => {
        setCostEvents((full?.events ?? []) as readonly ThreadTraceEvent[]);
        setCostOpen(true);
      })
      .catch(() => {
        Alert.alert(
          "Could not open cost",
          "Check your connection and try again.",
        );
      });
  }, []);

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
          headerShown: true,
          title: "",
          headerShadowVisible: false,
          // Let recent threads scroll under the profile chrome with soft edge fade.
          headerTransparent: IS_IOS,
          headerTintColor: foregroundColor,
          headerStyle: IS_IOS ? undefined : { backgroundColor },
          headerLeft: IS_IOS
            ? undefined
            : () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isAnonymous ? "Sign in" : "Profile"}
                  className={
                    isAnonymous
                      ? "h-10 items-center justify-center px-1"
                      : "bg-muted h-9 w-9 items-center justify-center rounded-full"
                  }
                  onPress={openProfile}
                >
                  {isAnonymous ? (
                    <Text
                      variant="label"
                      weight="semibold"
                      className="text-foreground"
                    >
                      Sign in
                    </Text>
                  ) : profileInitials ? (
                    <Text
                      variant="label"
                      weight="semibold"
                      className="text-foreground"
                    >
                      {profileInitials}
                    </Text>
                  ) : (
                    <Icon as={UserIcon} className="size-5 text-foreground" />
                  )}
                </Pressable>
              ),
        }}
      />
      {IS_IOS ? (
        <Stack.Toolbar placement="left">
          {isAnonymous ? (
            <Stack.Toolbar.Button
              accessibilityLabel="Sign in"
              onPress={openProfile}
            >
              Sign in
            </Stack.Toolbar.Button>
          ) : (
            // Fixed square hit target so liquid glass forms a circle instead of
            // a text-width pill around two-letter initials.
            <Stack.Toolbar.View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Profile"
                onPress={openProfile}
                style={{
                  width: 36,
                  height: 36,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {profileInitials ? (
                  <Text
                    variant="label"
                    weight="semibold"
                    style={{ color: foregroundColor }}
                  >
                    {profileInitials}
                  </Text>
                ) : (
                  <Icon as={UserIcon} className="size-5 text-foreground" />
                )}
              </Pressable>
            </Stack.Toolbar.View>
          )}
        </Stack.Toolbar>
      ) : null}
      <View style={{ flex: 1, zIndex: 0, overflow: "hidden" }}>
        {!billingReady ? (
          <BillingGateScreen onReady={markBillingReady} />
        ) : holdingLaunchHome ? null : (
          <HistoryScreen
            onOpenChat={openChat}
            chatActions={chatActions}
            bottomInset={listBottomInset}
            onCreateAgent={isAnonymous ? undefined : openCreateAgent}
          />
        )}
      </View>

      {billingReady && !holdingLaunchHome && guestHasThread ? (
        <SignInForNewChatCard />
      ) : null}

      {billingReady && !holdingLaunchHome && !guestHasThread ? (
        <HomeComposeFab onPress={openNewChat} />
      ) : null}

      <ThreadCostDrawer
        open={costOpen}
        events={costEvents}
        onClose={() => {
          setCostOpen(false);
          setCostEvents([]);
        }}
      />
      <CreateAgentModal
        open={createAgentOpen}
        onClose={() => setCreateAgentOpen(false)}
        onCreated={onAgentCreated}
      />
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
