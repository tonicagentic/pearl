import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform, Pressable, View } from "react-native";
import { Stack, router, useFocusEffect } from "expo-router";
import { PlusIcon, UserIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { HistoryScreen } from "@/components/home/app-drawer";
import { CreateAgentModal } from "@/components/home/create-agent-modal";
import {
  HOME_COMPOSE_FAB_CLEARANCE,
  HomeComposeFab,
} from "@/components/home/home-composer-dock";
import {
  SIGN_IN_CARD_CLEARANCE,
  SignInForNewChatCard,
} from "@/components/home/sign-in-for-new-chat-card";
import { BillingGateScreen } from "@/components/settings/billing-gate-screen";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";
import { chatListPresence } from "@/src/chat-presence";
import type { CustomAgentDto } from "@/src/custom-agents-client";
import { initials as viewerInitials } from "@/src/initials";

const IS_IOS = Platform.OS === "ios";

/**
 * Mail-style home: Profile, Agents, and History / Workspaces buttons.
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
    selectChat,
    reloadChats,
  } = useChats();

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

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "",
          headerShadowVisible: false,
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
          headerRight:
            IS_IOS || isAnonymous
              ? undefined
              : () => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="New agent"
                    className="h-10 w-10 items-center justify-center"
                    onPress={openCreateAgent}
                  >
                    <Icon as={PlusIcon} className="size-5 text-foreground" />
                  </Pressable>
                ),
        }}
      />
      {IS_IOS ? (
        <>
          <Stack.Toolbar placement="left">
            {isAnonymous ? (
              <Stack.Toolbar.Button
                accessibilityLabel="Sign in"
                onPress={openProfile}
              >
                Sign in
              </Stack.Toolbar.Button>
            ) : (
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
          {!isAnonymous ? (
            <Stack.Toolbar placement="right">
              <Stack.Toolbar.Button
                icon="plus"
                accessibilityLabel="New agent"
                onPress={openCreateAgent}
              />
            </Stack.Toolbar>
          ) : null}
        </>
      ) : null}
      <View style={{ flex: 1, zIndex: 0, overflow: "hidden" }}>
        {!billingReady ? (
          <BillingGateScreen onReady={markBillingReady} />
        ) : holdingLaunchHome ? null : (
          <HistoryScreen
            onOpenChat={openChat}
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

      <CreateAgentModal
        open={createAgentOpen}
        onClose={() => setCreateAgentOpen(false)}
        onCreated={onAgentCreated}
      />
    </View>
  );
}
