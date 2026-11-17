import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import { Alert, AppState, Platform, Pressable, View } from "react-native";
import { Stack, router, useFocusEffect } from "expo-router";
import { UserIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import {
  HistoryScreen,
  type HistoryChatActionHandlers,
} from "@/components/home/app-drawer";
import {
  HOME_COMPOSER_CLEARANCE,
  HomeComposerDock,
} from "@/components/home/home-composer-dock";
import {
  SIGN_IN_CARD_CLEARANCE,
  SignInForNewChatCard,
} from "@/components/home/sign-in-for-new-chat-card";
import { ProjectPickerModal } from "@/components/project-picker-modal";
import { BillingGateScreen } from "@/components/settings/billing-gate-screen";
import { ThreadCostDrawer } from "@/components/thread-cost-drawer";
import { WalkthroughOverlay } from "@/components/home/walkthrough-overlay";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";
import type { ChatListItem } from "@/src/chats-client";
import { initials as viewerInitials } from "@/src/initials";

const IS_IOS = Platform.OS === "ios";

/**
 * Mail-style home: Profile, recent chats with projects underneath, and a
 * full-width Ask Pearl control that opens a new chat.
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
  const homeFocusedRef = useRef(false);
  const composerRef = useRef<ComponentRef<typeof View>>(null);
  const openedGuestChat = useRef(false);
  const [holdingGuestHome, setHoldingGuestHome] = useState(isAnonymous);

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
    : HOME_COMPOSER_CLEARANCE;

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

  useEffect(() => {
    if (!isAnonymous) {
      setHoldingGuestHome(false);
      return;
    }
    if (!billingReady || !chatsReady || openedGuestChat.current) return;
    openedGuestChat.current = true;
    const existing = chats[0];
    const open = existing
      ? selectChat(existing.id).then((ok) => ok)
      : Promise.resolve(true);
    void open.then((ok) => {
      if (!existing) newChat();
      if (ok) {
        router.push({ pathname: "/chat", params: { guestEntry: "1" } });
      }
      setHoldingGuestHome(false);
    });
  }, [billingReady, chats, chatsReady, isAnonymous, newChat, selectChat]);

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
        {holdingGuestHome ? null : billingReady ? (
          <HistoryScreen
            onOpenChat={openChat}
            chatActions={chatActions}
            bottomInset={listBottomInset}
          />
        ) : (
          <BillingGateScreen onReady={markBillingReady} />
        )}
      </View>

      {billingReady && !holdingGuestHome ? (
        guestHasThread ? (
          <SignInForNewChatCard />
        ) : (
          <HomeComposerDock onPress={openNewChat} dockRef={composerRef} />
        )
      ) : null}

      {holdingGuestHome || guestHasThread ? null : (
        <WalkthroughOverlay composerRef={composerRef} />
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
