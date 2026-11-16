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
import { ComposeOverlay } from "@/components/home/compose-overlay";
import {
  HOME_COMPOSER_CLEARANCE,
  HomeComposerDock,
} from "@/components/home/home-composer-dock";
import { ProjectPickerModal } from "@/components/project-picker-modal";
import { BillingGateScreen } from "@/components/settings/billing-gate-screen";
import { ThreadCostDrawer } from "@/components/thread-cost-drawer";
import { WalkthroughOverlay } from "@/components/home/walkthrough-overlay";
import { dismissKeyboard } from "@/components/dismiss-keyboard";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";
import type { ChatListItem } from "@/src/chats-client";
import { setComposeHandoff } from "@/src/compose-handoff";
import { initials as viewerInitials } from "@/src/initials";

const IS_IOS = Platform.OS === "ios";
const LIST_BOTTOM_INSET = HOME_COMPOSER_CLEARANCE;

/**
 * Mail-style home: Profile, recent chats with projects underneath, and a
 * full-width Ask Pearl composer that expands like search and settles into a
 * thread on send.
 */
export function MailHomeScreen() {
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;
  const { billingReady, markBillingReady, viewerEmail, viewerName } = useAuth();
  const profileInitials = viewerInitials(viewerName, viewerEmail);
  const {
    newChat,
    deleteChat,
    renameChat,
    setChatProject,
    selectChat,
    reloadChats,
  } = useChats();

  const [composeActive, setComposeActive] = useState(false);
  const [composeDraft, setComposeDraft] = useState("");
  const [costOpen, setCostOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [projectTargetId, setProjectTargetId] = useState<string | null>(null);
  const homeFocusedRef = useRef(false);
  const composerRef = useRef<ComponentRef<typeof View>>(null);
  const chipsRef = useRef<ComponentRef<typeof View>>(null);

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

  const closeCompose = useCallback(() => {
    setComposeActive(false);
    setComposeDraft("");
    dismissKeyboard();
  }, []);

  const activateCompose = useCallback(() => {
    if (!billingReady) return;
    setComposeActive(true);
  }, [billingReady]);

  const settleThread = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (!billingReady) return;
      setComposeHandoff(trimmed);
      setComposeActive(false);
      setComposeDraft("");
      dismissKeyboard();
      newChat();
      router.push({
        pathname: "/chat",
        params: { settle: "1" },
      });
    },
    [billingReady, newChat],
  );

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
          headerTransparent: false,
          headerTintColor: foregroundColor,
          headerStyle: { backgroundColor },
          headerLeft: IS_IOS
            ? undefined
            : () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Profile"
                  className="h-10 w-10 items-center justify-center"
                  onPress={() => router.push("/settings")}
                >
                  {profileInitials ? (
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
          {profileInitials ? (
            <Stack.Toolbar.Button
              accessibilityLabel="Profile"
              onPress={() => router.push("/settings")}
            >
              {profileInitials}
            </Stack.Toolbar.Button>
          ) : (
            <Stack.Toolbar.Button
              icon="person"
              accessibilityLabel="Profile"
              onPress={() => router.push("/settings")}
            />
          )}
        </Stack.Toolbar>
      ) : null}
      <View
        style={{ flex: 1, zIndex: 0, overflow: "hidden" }}
        accessibilityElementsHidden={composeActive}
      >
        {billingReady ? (
          <HistoryScreen
            onOpenChat={openChat}
            chatActions={chatActions}
            visible={!composeActive}
            bottomInset={LIST_BOTTOM_INSET}
          />
        ) : (
          <BillingGateScreen onReady={markBillingReady} />
        )}
      </View>

      {billingReady ? (
        <>
          <ComposeOverlay
            visible={composeActive}
            onPick={settleThread}
            chipsRef={chipsRef}
          />
          <HomeComposerDock
            active={composeActive}
            value={composeDraft}
            onChangeText={setComposeDraft}
            onActivate={activateCompose}
            onClose={closeCompose}
            onSend={settleThread}
            dockRef={composerRef}
          />
        </>
      ) : null}

      <WalkthroughOverlay
        composerRef={composerRef}
        chipsRef={chipsRef}
        composeActive={composeActive}
        onActivateCompose={activateCompose}
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
