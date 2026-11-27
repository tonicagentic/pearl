import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Alert, AppState, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { MoreHorizontalIcon, SquarePenIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

import { ChatScreen } from "@/components/chat-screen";
import { useHistorySidebar } from "@/components/navigation/drawer-context";
import {
  ScreenChrome,
  type ScreenChromeAction,
} from "@/components/navigation/screen-chrome";
import type { HomeTab } from "@/components/home/home-tab";
import { HomeTabSwitcher } from "@/components/home/home-tab-switcher";
import { SignInForNewChatCard } from "@/components/home/sign-in-for-new-chat-card";
import { TrackScreen } from "@/components/home/track-screen";
import { ProjectPickerModal } from "@/components/project-picker-modal";
import { BillingGateScreen } from "@/components/settings/billing-gate-screen";
import { ThreadCostDrawer } from "@/components/thread-cost-drawer";
import {
  PEARL_IDENTITY_ACCENT,
  PEARL_MARK_HEIGHT_RATIO,
  ThreadIdentityMenu,
} from "@/components/thread-identity-menu";
import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";
import { getChat } from "@/src/chats-client";
import { fetchProjects } from "@/src/projects-client";
import type { ThreadTraceEvent } from "@/src/thread-trace";
import {
  getTrackShowFinance,
  loadTrackShowFinance,
  setTrackShowFinance,
  subscribeTrackShowFinance,
} from "@/src/track-finance-pref";

/**
 * Mail-style home: history sidebar button left; Chat|Overview switcher on the
 * empty Pearl / Overview tabs. An active Pearl chat drops the switcher and shows
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
    reloadChats,
  } = useChats();

  const [homeTab, setHomeTab] = useState<HomeTab>("pearl");
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

  const showFinance = useSyncExternalStore(
    subscribeTrackShowFinance,
    getTrackShowFinance,
    getTrackShowFinance,
  );

  useEffect(() => {
    void loadTrackShowFinance();
  }, []);

  // A live Pearl thread takes the trailing slot for New chat + details.
  const pearlThreadActive =
    homeTab === "pearl" && activeChatId != null && activeCustomAgent == null;
  const showPearlThreadChrome = pearlThreadActive;
  const showTabSwitcher = !pearlThreadActive;
  const showTrackMenu = homeTab === "track" && !isAnonymous;

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

  // Overview → Pearl while home stays focused (focus effect does not re-fire).
  useEffect(() => {
    if (homeTab !== "pearl" || !billingReady) {
      pearlComposeArmedRef.current = false;
      return;
    }
    if (!homeFocusedRef.current) return;
    armPearlCompose();
  }, [armPearlCompose, billingReady, homeTab]);

  const guestHasThread = isAnonymous && chats.length > 0;

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

  const toggleFinance = useCallback(() => {
    void setTrackShowFinance(!showFinance);
  }, [showFinance]);

  // Project-linked Pearl thread: title is the project (identity menu owns
  // change/remove/cost/delete). Unlinked Pearl keeps the ellipsis menu.
  const projectAsTitle =
    showPearlThreadChrome &&
    Boolean(activeProjectId) &&
    Boolean(projectLabel);

  const projectTitleSlot = useMemo(() => {
    if (!projectAsTitle || !projectLabel) return null;
    return (
      <ThreadIdentityMenu
        name={projectLabel}
        accent={PEARL_IDENTITY_ACCENT}
        heightRatio={PEARL_MARK_HEIGHT_RATIO}
        projectAsTitle
        projectLabel={projectLabel}
        hasProject
        canManageThread={Boolean(activeChatId)}
        onAddOrChangeProject={openProjectPicker}
        onRemoveProject={clearProject}
        onViewCost={openCost}
        onDelete={confirmDelete}
        allowAgentSwitch={false}
      />
    );
  }, [
    activeChatId,
    clearProject,
    confirmDelete,
    openCost,
    openProjectPicker,
    projectAsTitle,
    projectLabel,
  ]);

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
        hidden: !showPearlThreadChrome || projectAsTitle,
      },
      {
        type: "menu",
        label: "Thread details",
        systemImage: "ellipsis",
        icon: MoreHorizontalIcon,
        hidden: !showPearlThreadChrome || projectAsTitle,
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
        type: "menu",
        label: "Overview options",
        systemImage: "ellipsis",
        icon: MoreHorizontalIcon,
        hidden: !showTrackMenu,
        onPress: toggleFinance,
        items: [
          {
            label: showFinance ? "Hide Finance" : "Show Finance",
            systemImage: showFinance ? "eye.slash" : "eye",
            onPress: toggleFinance,
          },
        ],
      },
    ];
  }, [
    activeProjectId,
    clearProject,
    confirmDelete,
    openCost,
    openNewChat,
    openProjectPicker,
    openThreadDetails,
    projectAsTitle,
    projectLabel,
    showFinance,
    showPearlThreadChrome,
    showTrackMenu,
    toggleFinance,
  ]);

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <ScreenChrome
        wrapBody={false}
        leading="history"
        titleSlot={
          showTabSwitcher ? (
            <HomeTabSwitcher tab={homeTab} onChange={setHomeTab} />
          ) : (
            projectTitleSlot
          )
        }
        actions={chromeActions}
      >
        <View style={{ flex: 1, zIndex: 0, overflow: "hidden" }}>
          {!billingReady ? (
            <BillingGateScreen onReady={markBillingReady} />
          ) : homeTab === "pearl" ? (
            <ChatScreen embedded />
          ) : (
            <TrackScreen />
          )}
        </View>

        {billingReady && homeTab === "pearl" && guestHasThread ? (
          <SignInForNewChatCard />
        ) : null}

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
