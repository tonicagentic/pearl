import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, AppState, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { MoreHorizontalIcon, PlusIcon, SquarePenIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { ChatScreen } from "@/components/chat-screen";
import { HomeTabBody } from "@/components/home/home-tab-body";
import { CreateAgentModal } from "@/components/home/create-agent-modal";
import { useHistorySidebar } from "@/components/navigation/drawer-context";
import {
  ScreenChrome,
  type ScreenChromeAction,
} from "@/components/navigation/screen-chrome";
import type { HomeTab } from "@/components/home/home-tab";
import { HomeTabSwitcher } from "@/components/home/home-tab-switcher";
import {
  SIGN_IN_CARD_CLEARANCE,
  SignInForNewChatCard,
} from "@/components/home/sign-in-for-new-chat-card";
import { ProjectPickerModal } from "@/components/project-picker-modal";
import { BillingGateScreen } from "@/components/settings/billing-gate-screen";
import { ThreadCostDrawer } from "@/components/thread-cost-drawer";
import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";
import { getChat } from "@/src/chats-client";
import type { CustomAgentDto } from "@/src/custom-agents-client";
import { fetchProjects } from "@/src/projects-client";
import type { ThreadTraceEvent } from "@/src/thread-trace";

/**
 * Mail-style home: history sidebar button left; Chat|Delegate switcher on the
 * empty Pearl / Agents tabs. An active Pearl chat drops the switcher and shows
 * New chat + thread details on the right. Profile lives in the drawer dock.
 */
export function MailHomeScreen() {
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const { billingReady, isAnonymous, markBillingReady } = useAuth();
  const { setHomeChatHandler } = useHistorySidebar();
  const {
    activeChatId,
    activeCustomAgent,
    activeProjectId,
    setActiveProjectId,
    setChatProject,
    chats,
    deleteChat,
    newChat,
    selectChat,
    reloadChats,
  } = useChats();

  const [homeTab, setHomeTab] = useState<HomeTab>("pearl");
  const [createAgentOpen, setCreateAgentOpen] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  const [costEvents, setCostEvents] = useState<readonly ThreadTraceEvent[]>(
    [],
  );
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [projectLabel, setProjectLabel] = useState<string | null>(null);
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
  // A live Pearl thread takes the trailing slot for New chat + details.
  const pearlThreadActive =
    homeTab === "pearl" && activeChatId != null && activeCustomAgent == null;
  const showPearlThreadChrome = pearlThreadActive;
  const showTabSwitcher = !pearlThreadActive;

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
    setHomeChatHandler((options) => {
      setHomeTab(options?.tab ?? "pearl");
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
    // Push on the home stack (with index anchored) so back morphs into the
    // Delegate menu control.
    router.push("/chat", { withAnchor: true });
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

  useEffect(() => {
    if (!showPearlThreadChrome || !activeProjectId) {
      setProjectLabel(null);
      return;
    }
    let cancelled = false;
    void fetchProjects()
      .then((projects) => {
        if (cancelled) return;
        setProjectLabel(
          projects.find((project) => project.id === activeProjectId)?.name ??
            "Project",
        );
      })
      .catch(() => {
        if (!cancelled) setProjectLabel("Project");
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, showPearlThreadChrome]);

  const openCost = useCallback(() => {
    if (!activeChatId) return;
    void getChat(activeChatId)
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
  }, [activeChatId]);

  const openProjectPicker = useCallback(() => {
    setProjectPickerOpen(true);
  }, []);

  const clearProject = useCallback(() => {
    if (!activeChatId) return;
    setActiveProjectId(null);
    void setChatProject(activeChatId, null).catch(() => {
      Alert.alert(
        "Could not update project",
        "Check your connection and try again.",
      );
    });
  }, [activeChatId, setActiveProjectId, setChatProject]);

  const confirmDelete = useCallback(() => {
    if (!activeChatId) return;
    Alert.alert("Delete thread?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteChat(activeChatId).catch(() => {
            Alert.alert(
              "Could not delete",
              "Check your connection and try again.",
            );
          });
        },
      },
    ]);
  }, [activeChatId, deleteChat]);

  const openThreadDetails = useCallback(() => {
    Alert.alert("Thread", undefined, [
      {
        text: projectLabel ? "Change project" : "Add to project",
        onPress: openProjectPicker,
      },
      ...(activeProjectId
        ? [
            {
              text: "Remove from project",
              onPress: clearProject,
            },
          ]
        : []),
      { text: "View cost", onPress: openCost },
      { text: "Delete", style: "destructive" as const, onPress: confirmDelete },
      { text: "Cancel", style: "cancel" as const },
    ]);
  }, [
    activeProjectId,
    clearProject,
    confirmDelete,
    openCost,
    openProjectPicker,
    projectLabel,
  ]);

  const onAgentCreated = useCallback(
    (agent: CustomAgentDto) => {
      setCreateAgentOpen(false);
      setHomeTab("agents");
      void selectChat(agent.chatId).then((ok) => {
        if (ok) router.push("/chat", { withAnchor: true });
      });
    },
    [selectChat],
  );

  const chromeActions = useMemo((): readonly ScreenChromeAction[] => {
    return [
      {
        label: "New chat",
        systemImage: "square.and.pencil",
        icon: SquarePenIcon,
        onPress: openNewChat,
        hidden: !showPearlThreadChrome,
      },
      {
        type: "spacer",
        width: 8,
        hidden: !showPearlThreadChrome,
      },
      {
        type: "menu",
        label: "Thread details",
        systemImage: "ellipsis",
        icon: MoreHorizontalIcon,
        hidden: !showPearlThreadChrome,
        onPress: openThreadDetails,
        items: [
          {
            label: projectLabel ? "Change project" : "Add to project",
            systemImage: "folder",
            onPress: openProjectPicker,
          },
          {
            label: "Remove from project",
            systemImage: "folder.badge.minus",
            onPress: clearProject,
            hidden: !activeProjectId,
          },
          {
            label: "View cost",
            systemImage: "dollarsign.circle",
            onPress: openCost,
          },
          {
            label: "Delete",
            systemImage: "trash",
            destructive: true,
            onPress: confirmDelete,
          },
        ],
      },
      {
        type: "spacer",
        width: 8,
        hidden: !showAgentsPlus,
      },
      {
        label: "New agent",
        systemImage: "plus",
        icon: PlusIcon,
        onPress: openCreateAgent,
        separateBackground: true,
        hidden: !showAgentsPlus,
      },
    ];
  }, [
    activeProjectId,
    clearProject,
    confirmDelete,
    openCost,
    openCreateAgent,
    openNewChat,
    openProjectPicker,
    openThreadDetails,
    projectLabel,
    showAgentsPlus,
    showPearlThreadChrome,
  ]);

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <ScreenChrome
        wrapBody={false}
        transparentHeader
        leading="history"
        titleSlot={
          showTabSwitcher ? (
            <HomeTabSwitcher tab={homeTab} onChange={setHomeTab} />
          ) : null
        }
        actions={chromeActions}
      >
        <View style={{ flex: 1, zIndex: 0, overflow: "hidden" }}>
          {!billingReady ? (
            <BillingGateScreen onReady={markBillingReady} />
          ) : homeTab === "pearl" ? (
            <ChatScreen embedded />
          ) : (
            <HomeTabBody
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

        <ThreadCostDrawer
          open={costOpen}
          events={costEvents}
          onClose={() => {
            setCostOpen(false);
            setCostEvents([]);
          }}
        />
        <ProjectPickerModal
          open={projectPickerOpen}
          onClose={() => setProjectPickerOpen(false)}
          onSelect={(project) => {
            const chatId = activeChatId;
            setProjectPickerOpen(false);
            if (!chatId) return;
            setActiveProjectId(project.id);
            setProjectLabel(project.name);
            void setChatProject(chatId, project.id).catch(() => {
              Alert.alert(
                "Could not update project",
                "Check your connection and try again.",
              );
            });
          }}
        />
      </ScreenChrome>
    </View>
  );
}
