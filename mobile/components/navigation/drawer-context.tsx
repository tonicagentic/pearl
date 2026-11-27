import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import { router, useNavigation } from "expo-router";
import { useDrawerStatus } from "expo-router/drawer";
import * as Haptics from "expo-haptics";

import { useChats } from "@/src/chat-context";

type DrawerNav = {
  openDrawer?: () => void;
  closeDrawer?: () => void;
  toggleDrawer?: () => void;
  getParent?: () => DrawerNav | undefined;
};

function resolveDrawerNav(navigation: DrawerNav): DrawerNav | null {
  let current: DrawerNav | undefined = navigation;
  for (let i = 0; i < 8 && current; i += 1) {
    if (
      typeof current.openDrawer === "function" &&
      typeof current.closeDrawer === "function"
    ) {
      return current;
    }
    current = current.getParent?.();
  }
  return null;
}

export type HomeChatSelectOptions = {
  /** Which New Chat home tab to show (Chat | Track). */
  readonly tab?: "pearl" | "track";
};

type HomeChatHandler = (options?: HomeChatSelectOptions) => void;

type PearlDrawerContextValue = {
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
  /** False while a nested stack screen that can go back is focused. */
  readonly swipeEnabled: boolean;
  readonly setSwipeEnabled: (enabled: boolean) => void;
  readonly setHomeChatHandler: (handler: HomeChatHandler | null) => void;
  readonly notifyChatSelectedFromDrawer: (
    options?: HomeChatSelectOptions,
  ) => void;
};

const PearlDrawerContext = createContext<PearlDrawerContextValue | null>(null);

/**
 * Holds drawer open flag + mail-home embed handler. Open/close resolve from
 * the caller's navigation tree so this provider can sit above the Drawer.
 */
export function PearlDrawerProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [swipeEnabled, setSwipeEnabled] = useState(true);
  const homeChatHandlerRef = useRef<HomeChatHandler | null>(null);

  const setHomeChatHandler = useCallback((handler: HomeChatHandler | null) => {
    homeChatHandlerRef.current = handler;
  }, []);

  const notifyChatSelectedFromDrawer = useCallback(
    (options?: HomeChatSelectOptions) => {
      homeChatHandlerRef.current?.(options);
    },
    [],
  );

  const value = useMemo(
    () => ({
      open,
      setOpen,
      swipeEnabled,
      setSwipeEnabled,
      setHomeChatHandler,
      notifyChatSelectedFromDrawer,
    }),
    [
      open,
      swipeEnabled,
      setHomeChatHandler,
      notifyChatSelectedFromDrawer,
    ],
  );

  return (
    <PearlDrawerContext.Provider value={value}>
      {children}
    </PearlDrawerContext.Provider>
  );
}

/** Mount inside Drawer so useDrawerStatus is valid; syncs `open` to context. */
export function DrawerOpenSync() {
  const status = useDrawerStatus();
  const ctx = useContext(PearlDrawerContext);
  const open = status === "open";
  useEffect(() => {
    ctx?.setOpen(open);
  }, [ctx, open]);
  return null;
}

/**
 * Light impact when the drawer spring finishes open or closed.
 * Filters on the drawer navigator key so nested stack `transitionEnd`
 * (e.g. chat push) does not fire.
 */
export function useDrawerSettleHaptic() {
  const navigation = useNavigation();
  useEffect(() => {
    if (Platform.OS === "web") return;
    const unsub = navigation.addListener(
      "transitionEnd" as never,
      ((event: { target?: string }) => {
        if (event.target !== navigation.getState()?.key) return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
          () => {},
        );
      }) as never,
    );
    return unsub;
  }, [navigation]);
}

export function usePearlDrawer() {
  const ctx = useContext(PearlDrawerContext);
  if (!ctx) {
    throw new Error("usePearlDrawer must be used within PearlDrawerProvider");
  }
  const navigation = useNavigation() as unknown as DrawerNav;
  const { reloadChats, selectChat, getActiveCustomAgent } = useChats();

  const openDrawer = useCallback(() => {
    void reloadChats({ silent: true });
    resolveDrawerNav(navigation)?.openDrawer?.();
  }, [navigation, reloadChats]);

  const closeDrawer = useCallback(() => {
    resolveDrawerNav(navigation)?.closeDrawer?.();
  }, [navigation]);

  const toggleDrawer = useCallback(() => {
    const drawer = resolveDrawerNav(navigation);
    if (drawer?.toggleDrawer) {
      drawer.toggleDrawer();
      return;
    }
    drawer?.openDrawer?.();
  }, [navigation]);

  const onSelectChatFromDrawer = useCallback(
    async (chatId: string) => {
      const ok = await selectChat(chatId);
      if (!ok) return;
      const isAgentThread = getActiveCustomAgent() != null;
      closeDrawer();
      // Pearl threads stay embedded on home; custom agents open under
      // Delegate so native back returns to the agents list.
      if (isAgentThread) {
        router.push("/agents/chat", { withAnchor: true });
        return;
      }
      ctx.notifyChatSelectedFromDrawer({ tab: "pearl" });
      // navigate (not dismissTo): dismissTo emits POP_TO, which Drawer
      // routers ignore — from Projects/Tasks/etc. the action is a no-op.
      router.navigate("/");
    },
    [closeDrawer, ctx, getActiveCustomAgent, selectChat],
  );

  return {
    openDrawer,
    closeDrawer,
    toggleDrawer,
    setHomeChatHandler: ctx.setHomeChatHandler,
    notifyChatSelectedFromDrawer: ctx.notifyChatSelectedFromDrawer,
    onSelectChatFromDrawer,
    open: ctx.open,
    swipeEnabled: ctx.swipeEnabled,
    setSwipeEnabled: ctx.setSwipeEnabled,
    openSidebar: openDrawer,
    closeSidebar: closeDrawer,
    toggleSidebar: toggleDrawer,
  };
}

export function usePearlDrawerOptional() {
  const ctx = useContext(PearlDrawerContext);
  const navigation = useNavigation() as unknown as DrawerNav;
  const { reloadChats, selectChat, getActiveCustomAgent } = useChats();

  const openDrawer = useCallback(() => {
    void reloadChats({ silent: true });
    resolveDrawerNav(navigation)?.openDrawer?.();
  }, [navigation, reloadChats]);

  const closeDrawer = useCallback(() => {
    resolveDrawerNav(navigation)?.closeDrawer?.();
  }, [navigation]);

  if (!ctx) return null;

  return {
    openDrawer,
    closeDrawer,
    toggleDrawer: openDrawer,
    setHomeChatHandler: ctx.setHomeChatHandler,
    notifyChatSelectedFromDrawer: ctx.notifyChatSelectedFromDrawer,
    onSelectChatFromDrawer: async (chatId: string) => {
      const ok = await selectChat(chatId);
      if (!ok) return;
      const isAgentThread = getActiveCustomAgent() != null;
      closeDrawer();
      if (isAgentThread) {
        router.push("/agents/chat", { withAnchor: true });
        return;
      }
      ctx.notifyChatSelectedFromDrawer({ tab: "pearl" });
      // navigate (not dismissTo): dismissTo emits POP_TO, which Drawer
      // routers ignore — from Projects/Tasks/etc. the action is a no-op.
      router.navigate("/");
    },
    open: ctx.open,
    openSidebar: openDrawer,
    closeSidebar: closeDrawer,
    toggleSidebar: openDrawer,
  };
}

/** Compat aliases while call sites migrate off HistorySidebar naming. */
export const useHistorySidebar = usePearlDrawer;
export const useHistorySidebarOptional = usePearlDrawerOptional;
