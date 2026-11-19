import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform, Pressable, View } from "react-native";
import { Stack, router, useFocusEffect } from "expo-router";
import { ClockIcon, PlusIcon, UserIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { ChatScreen } from "@/components/chat-screen";
import { HistoryScreen } from "@/components/home/app-drawer";
import { CreateAgentModal } from "@/components/home/create-agent-modal";
import type { HomeTab } from "@/components/home/home-tab";
import { HomeTabSwitcher } from "@/components/home/home-tab-switcher";
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
 * Mail-style home: Profile left; Pearl|Agents switcher; History / New agent right.
 * Pearl tab embeds a new-chat composer with keyboard open.
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

  const [homeTab, setHomeTab] = useState<HomeTab>("pearl");
  const [createAgentOpen, setCreateAgentOpen] = useState(false);
  const homeFocusedRef = useRef(false);
  const homeTabRef = useRef(homeTab);
  homeTabRef.current = homeTab;
  const billingReadyRef = useRef(billingReady);
  billingReadyRef.current = billingReady;
  const reloadChatsRef = useRef(reloadChats);
  reloadChatsRef.current = reloadChats;
  const newChatRef = useRef(newChat);
  newChatRef.current = newChat;
  // Pearl tab = fresh compose + keyboard. Armed while the draft is live so
  // callback identity churn does not wipe mid-compose.
  const pearlComposeArmedRef = useRef(false);
  const showAgentsPlus = homeTab === "agents" && !isAnonymous;
  const showPearlHistory = homeTab === "pearl";

  const armPearlCompose = useCallback(() => {
    if (pearlComposeArmedRef.current) return;
    pearlComposeArmedRef.current = true;
    newChatRef.current();
  }, []);

  useFocusEffect(
    useCallback(() => {
      homeFocusedRef.current = true;
      void reloadChatsRef.current({ silent: true });
      // Returning to home on Pearl always starts a fresh draft.
      if (homeTabRef.current === "pearl" && billingReadyRef.current) {
        pearlComposeArmedRef.current = false;
        armPearlCompose();
      }
      return () => {
        homeFocusedRef.current = false;
        pearlComposeArmedRef.current = false;
      };
    }, [armPearlCompose]),
  );

  useEffect(() => {
    const onChange = (next: string) => {
      if (next === "active" && homeFocusedRef.current) {
        void reloadChatsRef.current({ silent: true });
      }
    };
    const subscription = AppState.addEventListener("change", onChange);
    return () => subscription.remove();
  }, []);

  // Agents → Pearl while home stays focused (focus effect does not re-fire).
  useEffect(() => {
    if (homeTab !== "pearl" || !billingReady) {
      pearlComposeArmedRef.current = false;
      return;
    }
    if (!homeFocusedRef.current) return;
    armPearlCompose();
  }, [armPearlCompose, billingReady, homeTab]);

  const openChat = useCallback(() => {
    router.push("/chat");
  }, []);

  const guestHasThread = isAnonymous && chats.length > 0;
  const agentsBottomInset = guestHasThread ? SIGN_IN_CARD_CLEARANCE : 24;

  const openCreateAgent = useCallback(() => {
    if (!billingReady || isAnonymous) return;
    setCreateAgentOpen(true);
  }, [billingReady, isAnonymous]);

  const openHistory = useCallback(() => {
    router.push("/history");
  }, []);

  const onAgentCreated = useCallback(
    (agent: CustomAgentDto) => {
      setCreateAgentOpen(false);
      setHomeTab("agents");
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
          headerTitle: () => (
            <HomeTabSwitcher tab={homeTab} onChange={setHomeTab} />
          ),
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
                  {showPearlHistory ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="History"
                      className="h-10 w-10 items-center justify-center"
                      onPress={openHistory}
                    >
                      <Icon as={ClockIcon} className="size-5 text-foreground" />
                    </Pressable>
                  ) : null}
                  {showAgentsPlus ? (
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
              hidden={!showPearlHistory}
            />
            <Stack.Toolbar.Spacer width={8} hidden={!showAgentsPlus} />
            <Stack.Toolbar.Button
              icon="plus"
              accessibilityLabel="New agent"
              onPress={openCreateAgent}
              separateBackground
              hidden={!showAgentsPlus}
            />
          </Stack.Toolbar>
        </>
      ) : null}
      <View style={{ flex: 1, zIndex: 0, overflow: "hidden" }}>
        {!billingReady ? (
          <BillingGateScreen onReady={markBillingReady} />
        ) : homeTab === "pearl" ? (
          <ChatScreen embedded />
        ) : (
          <HistoryScreen
            tab="agents"
            onOpenChat={openChat}
            bottomInset={agentsBottomInset}
          />
        )}
      </View>

      {billingReady && homeTab === "pearl" && guestHasThread ? (
        <SignInForNewChatCard />
      ) : null}

      <CreateAgentModal
        open={createAgentOpen}
        onClose={() => setCreateAgentOpen(false)}
        onCreated={onAgentCreated}
      />
    </View>
  );
}
