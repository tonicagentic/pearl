import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform, Pressable, View } from "react-native";
import { Stack, router, useFocusEffect } from "expo-router";
import { ClockIcon, FolderIcon, PlusIcon, UserIcon } from "lucide-react-native";
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
import type { CustomAgentDto } from "@/src/custom-agents-client";
import { initials as viewerInitials } from "@/src/initials";

const IS_IOS = Platform.OS === "ios";

/**
 * Mail-style home: Profile left; History / Workspaces / New agent right.
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
  const { chats, newChat, selectChat, reloadChats } = useChats();

  const [createAgentOpen, setCreateAgentOpen] = useState(false);
  const homeFocusedRef = useRef(false);

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

  const openHistory = useCallback(() => {
    router.push("/history");
  }, []);

  const openWorkspaces = useCallback(() => {
    router.push("/workspaces");
  }, []);

  const onAgentCreated = useCallback(
    (agent: CustomAgentDto) => {
      setCreateAgentOpen(false);
      void selectChat(agent.chatId).then((ok) => {
        if (ok) router.push("/chat");
      });
    },
    [selectChat],
  );

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
          headerRight: IS_IOS
            ? undefined
            : () => (
                <View className="flex-row items-center">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="History"
                    className="h-10 w-10 items-center justify-center"
                    onPress={openHistory}
                  >
                    <Icon as={ClockIcon} className="size-5 text-foreground" />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Workspaces"
                    className="h-10 w-10 items-center justify-center"
                    onPress={openWorkspaces}
                  >
                    <Icon as={FolderIcon} className="size-5 text-foreground" />
                  </Pressable>
                  {!isAnonymous ? (
                    <>
                      <View style={{ width: 8 }} />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="New agent"
                        className="h-10 w-10 items-center justify-center"
                        onPress={openCreateAgent}
                      >
                        <Icon
                          as={PlusIcon}
                          className="size-5 text-foreground"
                        />
                      </Pressable>
                    </>
                  ) : null}
                </View>
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
          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button
              icon="clock"
              accessibilityLabel="History"
              onPress={openHistory}
            />
            <Stack.Toolbar.Button
              icon="folder"
              accessibilityLabel="Workspaces"
              onPress={openWorkspaces}
            />
            <Stack.Toolbar.Spacer width={8} hidden={isAnonymous} />
            <Stack.Toolbar.Button
              icon="plus"
              accessibilityLabel="New agent"
              onPress={openCreateAgent}
              separateBackground
              hidden={isAnonymous}
            />
          </Stack.Toolbar>
        </>
      ) : null}
      <View style={{ flex: 1, zIndex: 0, overflow: "hidden" }}>
        {!billingReady ? (
          <BillingGateScreen onReady={markBillingReady} />
        ) : (
          <HistoryScreen
            onOpenChat={openChat}
            bottomInset={listBottomInset}
            onCreateAgent={isAnonymous ? undefined : openCreateAgent}
          />
        )}
      </View>

      {billingReady && guestHasThread ? <SignInForNewChatCard /> : null}

      {billingReady && !guestHasThread ? (
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
