import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  closeTab,
  emptyWorkspace,
  openFileTab,
  selectTab,
  syncPageTabs,
} from "../../lib/browser/tabs";
import type {
  BrowserControlMode,
  BrowserTabInfo,
  WorkspaceState,
  WorkspaceTab,
} from "../../lib/browser/types";
import { AGENT_URL, getAuthCookie } from "./eve-transport";

type WorkspaceContextValue = {
  readonly workspace: WorkspaceState;
  readonly tabs: readonly WorkspaceTab[];
  readonly activeTabId: string | null;
  readonly open: boolean;
  readonly controlMode: BrowserControlMode;
  readonly viewUrl: string | null;
  readonly chatId: string | null;
  openFile: (args: {
    readonly id?: string;
    readonly path: string;
    readonly content: string;
    readonly version?: number;
  }) => void;
  openBrowserPages: (pages: readonly BrowserTabInfo[]) => void;
  selectWorkspaceTab: (tabId: string) => void;
  closeWorkspaceTab: (tabId: string) => void;
  closeWorkspace: () => void;
  setControlMode: (mode: BrowserControlMode) => void;
  ensureViewUrl: () => Promise<void>;
  setChatId: (chatId: string | null) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function authHeaders(): Record<string, string> {
  const credential = getAuthCookie();
  return {
    "content-type": "application/json",
    ...(credential ? { authorization: `Bearer ${credential}` } : {}),
  };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<WorkspaceState>(emptyWorkspace);
  const [controlMode, setControlMode] = useState<BrowserControlMode>("agent");
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);

  const openFile = useCallback(
    (args: {
      readonly id?: string;
      readonly path: string;
      readonly content: string;
      readonly version?: number;
    }) => {
      setWorkspace((prev) =>
        openFileTab(prev, {
          id: args.id ?? `ref:${args.path}`,
          path: args.path,
          content: args.content,
          running: false,
          note: null,
          version: args.version ?? 1,
        }),
      );
    },
    [],
  );

  const openBrowserPages = useCallback((pages: readonly BrowserTabInfo[]) => {
    setWorkspace((prev) =>
      syncPageTabs(
        prev,
        pages.map((page) => ({
          pageId: page.id,
          url: page.url,
          title: page.title || page.url,
          active: page.active,
        })),
      ),
    );
  }, []);

  const selectWorkspaceTab = useCallback((tabId: string) => {
    setWorkspace((prev) => selectTab(prev, tabId));
  }, []);

  const closeWorkspaceTab = useCallback((tabId: string) => {
    setWorkspace((prev) => closeTab(prev, tabId));
  }, []);

  const closeWorkspace = useCallback(() => {
    setWorkspace(emptyWorkspace());
  }, []);

  const ensureViewUrl = useCallback(async () => {
    if (!chatId || viewUrl) return;
    try {
      const res = await fetch(
        `${AGENT_URL}/api/chats/${encodeURIComponent(chatId)}/browser`,
        { headers: authHeaders() },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { viewUrl?: string };
      if (data.viewUrl) setViewUrl(data.viewUrl);
    } catch {
      // Leave viewUrl null; the workspace shows a starting state.
    }
  }, [chatId, viewUrl]);

  const value = useMemo(
    () => ({
      workspace,
      tabs: workspace.tabs,
      activeTabId: workspace.activeTabId,
      open: workspace.tabs.length > 0,
      controlMode,
      viewUrl,
      chatId,
      openFile,
      openBrowserPages,
      selectWorkspaceTab,
      closeWorkspaceTab,
      closeWorkspace,
      setControlMode,
      ensureViewUrl,
      setChatId,
    }),
    [
      workspace,
      controlMode,
      viewUrl,
      chatId,
      openFile,
      openBrowserPages,
      selectWorkspaceTab,
      closeWorkspaceTab,
      closeWorkspace,
      ensureViewUrl,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}

/** Optional hook for surfaces that may render outside the provider. */
export function useWorkspaceOptional(): WorkspaceContextValue | null {
  return useContext(WorkspaceContext);
}
