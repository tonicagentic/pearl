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
  openFileTab,
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

// Page-level workspace: file and live-browser tabs beside the thread.
// write_file claims a file tab while it streams; the browser tool syncs page
// tabs from the control server. Closing the last tab collapses the panel.

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

type CanvasContextValue = {
  readonly chatId: string | null;
  readonly workspace: WorkspaceState;
  readonly tabs: readonly WorkspaceTab[];
  readonly activeTabId: string | null;
  /** Active file tab, or null when a page is focused / nothing open. */
  readonly document: CanvasDocument | null;
  readonly controlMode: BrowserControlMode;
  readonly viewUrl: string | null;
  openDocument: (doc: CanvasDocument) => void;
  openPath: (path: string, content?: string) => void;
  updateDocument: (
    id: string,
    patch: Partial<Omit<CanvasDocument, "id">>,
  ) => void;
  updateDocumentByPath: (
    path: string,
    update: (doc: CanvasDocument) => CanvasDocument,
  ) => void;
  closeDocument: () => void;
  selectWorkspaceTab: (tabId: string) => void;
  closeWorkspaceTab: (tabId: string) => void;
  syncBrowserPages: (pages: readonly BrowserTabInfo[]) => void;
  openBrowserPage: (page: Omit<WorkspacePageTab, "kind" | "id">) => void;
  setControlMode: (mode: BrowserControlMode) => void;
  setViewUrl: (url: string | null) => void;
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
  const [controlMode, setControlMode] = useState<BrowserControlMode>("agent");
  const [viewUrl, setViewUrl] = useState<string | null>(null);
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

  const openPath = useCallback(
    (path: string, content?: string) => {
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
    setWorkspace((prev) => openFileTab(prev, doc));
  }, []);

  const updateDocument = useCallback(
    (id: string, patch: Partial<Omit<CanvasDocument, "id">>) => {
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
    setWorkspace((prev) => selectTab(prev, tabId));
  }, []);

  const closeWorkspaceTab = useCallback((tabId: string) => {
    setWorkspace((prev) => closeTab(prev, tabId));
  }, []);

  const syncBrowserPages = useCallback((pages: readonly BrowserTabInfo[]) => {
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

  const openBrowserPage = useCallback(
    (page: Omit<WorkspacePageTab, "kind" | "id">) => {
      setWorkspace((prev) => openPageTab(prev, page));
    },
    [],
  );

  const value = useMemo(
    () => ({
      chatId: chatId ?? null,
      workspace,
      tabs: workspace.tabs,
      activeTabId: workspace.activeTabId,
      document,
      controlMode,
      viewUrl,
      openDocument,
      openPath,
      updateDocument,
      updateDocumentByPath,
      closeDocument,
      selectWorkspaceTab,
      closeWorkspaceTab,
      syncBrowserPages,
      openBrowserPage,
      setControlMode,
      setViewUrl,
    }),
    [
      chatId,
      workspace,
      document,
      controlMode,
      viewUrl,
      openDocument,
      openPath,
      updateDocument,
      updateDocumentByPath,
      closeDocument,
      selectWorkspaceTab,
      closeWorkspaceTab,
      syncBrowserPages,
      openBrowserPage,
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
