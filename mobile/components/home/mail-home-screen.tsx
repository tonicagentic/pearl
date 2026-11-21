import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform, Pressable, View } from "react-native";
import { Stack, router, useFocusEffect } from "expo-router";
import { PlusIcon, SquarePenIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { ChatScreen } from "@/components/chat-screen";
import { HistoryScreen } from "@/components/home/app-drawer";
import { CreateAgentModal } from "@/components/home/create-agent-modal";
import { HistorySidebarButton } from "@/components/home/history-sidebar-button";
import { useHistorySidebar } from "@/components/home/history-sidebar";
import type { HomeTab } from "@/components/home/home-tab";
import { HomeTabSwitcher } from "@/components/home/home-tab-switcher";
import {
  SIGN_IN_CARD_CLEARANCE,
  SignInForNewChatCard,
} from "@/components/home/sign-in-for-new-chat-card";
import { BillingGateScreen } from "@/components/settings/billing-gate-screen";
import { Icon } from "@/components/ui/icon";
import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";
import type { CustomAgentDto } from "@/src/custom-agents-client";

const IS_IOS = Platform.OS === "ios";

/**
 * Mail-style home: history sidebar button left; Chat|Delegate switcher;
 * New chat / New agent right. Profile lives in the drawer dock.
 */
export function MailHomeScreen() {
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;
  const { billingReady, isAnonymous, markBillingReady } = useAuth();
  const { open: historyOpen, openSidebar, setHomeChatHandler } =
    useHistorySidebar();
  const {
    activeChatId,
    activeCustomAgent,
    chats,
    newChat,
    selectChat,
    reloadChats,
  } = useChats();

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
  const activeChatIdRef = useRef(activeChatId);
  activeChatIdRef.current = activeChatId;
  // Pearl tab = fresh compose + keyboard. Armed while the draft is live so
  // callback identity churn does not wipe mid-compose.
  const pearlComposeArmedRef = useRef(false);
  const showAgentsPlus = homeTab === "agents" && !isAnonymous;
  // A live Pearl thread takes the trailing slot for New chat.
  const pearlThreadActive =
    homeTab === "pearl" && activeChatId != null && activeCustomAgent == null;
  const showPearlNewChat = pearlThreadActive;

  const armPearlCompose = useCallback(() => {
    if (pearlComposeArmedRef.current) return;
    // Keep a thread selected from the history drawer (don't wipe with newChat).
    if (activeChatIdRef.current != null) {
      pearlComposeArmedRef.current = true;
      return;
    }
    pearlComposeArmedRef.current = true;
    newChatRef.current();
  }, []);

  useEffect(() => {
    setHomeChatHandler(() => {
      setHomeTab("pearl");
    });
    return () => setHomeChatHandler(null);
  }, [setHomeChatHandler]);

  useFocusEffect(
    useCallback(() => {
      homeFocusedRef.current = true;
      void reloadChatsRef.current({ silent: true });
      // Fresh draft only when nothing is selected (history picks keep their chat).
      if (
        homeTabRef.current === "pearl" &&
        billingReadyRef.current &&
        activeChatIdRef.current == null
      ) {
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

  const openNewChat = useCallback(() => {
    // Guests keep one saved thread; another chat starts after sign-in.
    if (isAnonymous) {
      router.push("/sign-in");
      return;
    }
    newChat();
  }, [isAnonymous, newChat]);

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
            : () =>
                historyOpen ? null : (
                  <HistorySidebarButton onPress={openSidebar} />
                ),
          headerRight: IS_IOS
            ? undefined
            : () => (
                <View className="flex-row items-center">
                  {showPearlNewChat ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="New chat"
                      className="h-10 w-10 items-center justify-center"
                      onPress={openNewChat}
                    >
                      <Icon
                        as={SquarePenIcon}
                        className="size-5 text-foreground"
                      />
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
            {historyOpen ? null : (
              <Stack.Toolbar.View hidesSharedBackground>
                <View style={{ width: 44, height: 44 }}>
                  <HistorySidebarButton onPress={openSidebar} />
                </View>
              </Stack.Toolbar.View>
            )}
          </Stack.Toolbar>
          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button
              icon="square.and.pencil"
              accessibilityLabel="New chat"
              onPress={openNewChat}
              hidden={!showPearlNewChat}
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
