"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  activeFileTab,
  closeActiveTab,
  closeTab,
  emptyWorkspace,
  openDesktopTab,
  openFileTab,
  openLibraryTab,
  openOrFocusPageByUrl,
  openPageTab,
  selectTab,
  syncPageTabs,
  updateFileTab,
  updateFileTabByPath,
} from "@/lib/browser/tabs";
import type {
  BrowserControlMode,
  BrowserTabInfo,
  WorkspacePageTab,
  WorkspaceState,
  WorkspaceTab,
} from "@/lib/browser/types";

// Page-level workspace: file, library, and live-browser tabs beside the thread.
// Panel visibility is independent of tabs so the user can open the sidebar
// anytime. write_file claims a file tab while it streams; the browser tool
// syncs page tabs from the control server.

/** @deprecated Prefer WorkspaceFileTab — kept for existing file tool callers. */
export type CanvasDocument = {
  readonly id: string;
  readonly path: string;
  readonly content: string;
  readonly running: boolean;
  readonly note: string | null;
  readonly version: number;
};

const pathVersions = new Map<string, number>();
const callVersions = new Map<string, number>();

export function versionForCall(
  callId: string,
  path: string,
  completed: boolean,
): number {
  if (!completed) {
    return pathVersions.get(path) ?? 1;
  }

  const assigned = callVersions.get(callId);
  if (assigned !== undefined) {
    return assigned;
  }

  const next = (pathVersions.get(path) ?? 0) + 1;
  pathVersions.set(path, next);
  callVersions.set(callId, next);
  return next;
}

export function pathVersion(path: string): number {
  return pathVersions.get(path) ?? 1;
}

function workspacePathForBasename(name: string): string {
  const trimmed = name.trim() || "untitled.md";
  const safe = trimmed.replace(/[^\w.\-]+/g, "-").replace(/^\.+/, "");
  return `/workspace/${safe || "untitled.md"}`;
}

type CanvasContextValue = {
  readonly chatId: string | null;
  readonly workspace: WorkspaceState;
  readonly tabs: readonly WorkspaceTab[];
  readonly activeTabId: string | null;
  /** Sidebar open; independent of whether any tab exists. */
  readonly panelOpen: boolean;
  /** Active file tab, or null when a page is focused / nothing open. */
  readonly document: CanvasDocument | null;
  readonly controlMode: BrowserControlMode;
  readonly viewUrl: string | null;
  /** screen-relay viewer URL (token in hash). Separate from Chromium viewUrl. */
  readonly desktopViewUrl: string | null;
  setPanelOpen: (open: boolean) => void;
  openPanel: () => void;
  closePanel: () => void;
  openDocument: (doc: CanvasDocument) => void;
  openPath: (path: string, content?: string) => void;
  openLibrary: () => void;
  openNewFile: (name?: string) => void;
  openBrowserUrl: (url: string) => void;
  updateDocument: (
    id: string,
    patch: Partial<Omit<CanvasDocument, "id">> & { readonly dirty?: boolean },
  ) => void;
  updateDocumentByPath: (
    path: string,
    update: (doc: CanvasDocument) => CanvasDocument,
  ) => void;
  closeDocument: () => void;
  selectWorkspaceTab: (tabId: string) => void;
  closeWorkspaceTab: (tabId: string) => void;
  syncBrowserPages: (
    pages: readonly BrowserTabInfo[],
    options?: { readonly focusActivePage?: boolean },
  ) => void;
  openBrowserPage: (page: Omit<WorkspacePageTab, "kind" | "id">) => void;
  openDesktop: (title?: string) => void;
  setControlMode: (mode: BrowserControlMode) => void;
  setViewUrl: (url: string | null) => void;
  setDesktopViewUrl: (url: string | null) => void;
};

const CanvasContext = createContext<CanvasContextValue | null>(null);

export function CanvasProvider({
  children,
  chatId,
}: {
  children: ReactNode;
  /** Chat used to resolve file content for openPath (null before a chat exists). */
  chatId?: string | null;
}) {
  const [workspace, setWorkspace] = useState<WorkspaceState>(emptyWorkspace);
  const [panelOpen, setPanelOpenState] = useState(false);
  const [controlMode, setControlMode] = useState<BrowserControlMode>("agent");
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [desktopViewUrl, setDesktopViewUrl] = useState<string | null>(null);
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;

  const document = useMemo(() => {
    const file = activeFileTab(workspace);
    if (!file) return null;
    return {
      id: file.id,
      path: file.path,
      content: file.content,
      running: file.running,
      note: file.note,
      version: file.version,
    } satisfies CanvasDocument;
  }, [workspace]);

  const setPanelOpen = useCallback((open: boolean) => {
    setPanelOpenState(open);
  }, []);

  const openPanel = useCallback(() => {
    setPanelOpenState(true);
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpenState(false);
  }, []);

  const openPath = useCallback(
    (path: string, content?: string) => {
      setPanelOpenState(true);
      const current = activeFileTab(workspaceRef.current);
      if (current?.path === path) {
        setWorkspace((prev) => selectTab(prev, current.id));
        return;
      }
      if (content !== undefined) {
        setWorkspace((prev) =>
          openFileTab(prev, {
            id: `ref:${path}`,
            path,
            content,
            running: false,
            note: null,
            version: pathVersion(path),
          }),
        );
        return;
      }
      if (!chatId) return;
      void (async () => {
        try {
          const list = (await (
            await fetch(`/api/chats/${chatId}/files`)
          ).json()) as {
            files?: readonly { id: string; path: string }[];
          };
          const file = list.files?.find(
            (f) => f.path === path || f.path.endsWith(`/${path}`),
          );
          if (!file) return;
          const text = await (
            await fetch(`/api/chats/${chatId}/files?fileId=${file.id}`)
          ).text();
          setWorkspace((prev) =>
            openFileTab(prev, {
              id: `file:${file.id}`,
              path: file.path,
              content: text,
              running: false,
              note: null,
              version: pathVersion(file.path),
            }),
          );
        } catch {
          // No content available — leave the workspace as it is.
        }
      })();
    },
    [chatId],
  );

  const openDocument = useCallback((doc: CanvasDocument) => {
    setPanelOpenState(true);
    setWorkspace((prev) => openFileTab(prev, doc));
  }, []);

  const openLibrary = useCallback(() => {
    setPanelOpenState(true);
    setWorkspace((prev) => openLibraryTab(prev));
  }, []);

  const openNewFile = useCallback((name?: string) => {
    setPanelOpenState(true);
    const path = workspacePathForBasename(name ?? "untitled.md");
    setWorkspace((prev) =>
      openFileTab(prev, {
        id: `new:${path}:${Date.now()}`,
        path,
        content: "",
        running: false,
        note: null,
        version: 1,
        dirty: true,
      }),
    );
  }, []);

  const openBrowserUrl = useCallback((url: string) => {
    setPanelOpenState(true);
    const trimmed = url.trim() || "about:blank";
    setWorkspace((prev) => openOrFocusPageByUrl(prev, trimmed));
  }, []);

  const updateDocument = useCallback(
    (
      id: string,
      patch: Partial<Omit<CanvasDocument, "id">> & { readonly dirty?: boolean },
    ) => {
      setWorkspace((prev) => updateFileTab(prev, id, patch));
    },
    [],
  );

  const updateDocumentByPath = useCallback(
    (
      path: string,
      update: (doc: CanvasDocument) => CanvasDocument,
    ): void => {
      setWorkspace((prev) =>
        updateFileTabByPath(prev, path, (tab) => {
          const next = update({
            id: tab.id,
            path: tab.path,
            content: tab.content,
            running: tab.running,
            note: tab.note,
            version: tab.version,
          });
          return {
            ...tab,
            path: next.path,
            content: next.content,
            running: next.running,
            note: next.note,
            version: next.version,
          };
        }),
      );
    },
    [],
  );

  const closeDocument = useCallback(() => {
    setWorkspace((prev) => closeActiveTab(prev));
  }, []);

  const selectWorkspaceTab = useCallback((tabId: string) => {
    setPanelOpenState(true);
    setWorkspace((prev) => selectTab(prev, tabId));
  }, []);

  const closeWorkspaceTab = useCallback((tabId: string) => {
    setWorkspace((prev) => closeTab(prev, tabId));
  }, []);

  const syncBrowserPages = useCallback(
    (
      pages: readonly BrowserTabInfo[],
      options?: { readonly focusActivePage?: boolean },
    ) => {
      if (pages.length > 0) setPanelOpenState(true);
      setWorkspace((prev) =>
        syncPageTabs(
          prev,
          pages.map((page) => ({
            pageId: page.id,
            url: page.url,
            title: page.title || page.url,
            active: page.active,
          })),
          options,
        ),
      );
    },
    [],
  );

  const openBrowserPage = useCallback(
    (page: Omit<WorkspacePageTab, "kind" | "id">) => {
      setPanelOpenState(true);
      setWorkspace((prev) => openPageTab(prev, page));
    },
    [],
  );

  const openDesktop = useCallback((title?: string) => {
    setPanelOpenState(true);
    setWorkspace((prev) => openDesktopTab(prev, title ?? "Desktop"));
  }, []);

  const value = useMemo(
    () => ({
      chatId: chatId ?? null,
      workspace,
      tabs: workspace.tabs,
      activeTabId: workspace.activeTabId,
      panelOpen,
      document,
      controlMode,
      viewUrl,
      desktopViewUrl,
      setPanelOpen,
      openPanel,
      closePanel,
      openDocument,
      openPath,
      openLibrary,
      openNewFile,
      openBrowserUrl,
      updateDocument,
      updateDocumentByPath,
      closeDocument,
      selectWorkspaceTab,
      closeWorkspaceTab,
      syncBrowserPages,
      openBrowserPage,
      openDesktop,
      setControlMode,
      setViewUrl,
      setDesktopViewUrl,
    }),
    [
      chatId,
      workspace,
      panelOpen,
      document,
      controlMode,
      viewUrl,
      desktopViewUrl,
      setPanelOpen,
      openPanel,
      closePanel,
      openDocument,
      openPath,
      openLibrary,
      openNewFile,
      openBrowserUrl,
      updateDocument,
      updateDocumentByPath,
      closeDocument,
      selectWorkspaceTab,
      closeWorkspaceTab,
      syncBrowserPages,
      openBrowserPage,
      openDesktop,
    ],
  );

  return (
    <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>
  );
}

export function useCanvas(): CanvasContextValue {
  const ctx = useContext(CanvasContext);

  if (!ctx) {
    throw new Error("useCanvas must be used within a CanvasProvider");
  }

  return ctx;
}

/** Soft optional hook for surfaces that may sit outside CanvasProvider. */
export function useOptionalCanvas(): CanvasContextValue | null {
  return useContext(CanvasContext);
}
