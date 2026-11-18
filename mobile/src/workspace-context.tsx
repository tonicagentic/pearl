import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  activeFileTab,
  closeTab,
  emptyWorkspace,
  openFileTab,
  selectTab,
  syncPageTabs,
  updateFileTab,
  updateFileTabByPath,
} from "../../lib/browser/tabs";
import type {
  BrowserControlMode,
  BrowserTabInfo,
  WorkspaceFileTab,
  WorkspaceState,
  WorkspaceTab,
} from "../../lib/browser/types";
import { isEditableCanvasPath } from "../../lib/design/file-preview";
import { fetchChatFileContent, saveChatFile } from "./chat-files";
import { AGENT_URL, getAuthCookie } from "./eve-transport";
import { previewWorkspaceFile } from "./preview-workspace-file";

/** Screen-space rect of the Writing card used to expand into the canvas. */
export type CanvasOrigin = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

type WorkspaceContextValue = {
  readonly workspace: WorkspaceState;
  readonly tabs: readonly WorkspaceTab[];
  readonly activeTabId: string | null;
  readonly activeFile: WorkspaceFileTab | null;
  readonly open: boolean;
  readonly controlMode: BrowserControlMode;
  readonly viewUrl: string | null;
  readonly chatId: string | null;
  /**
   * When true, Computer should show the workspace reader instead of the
   * file/window list (set when a chat card opens an in-app file).
   */
  readonly preferDetail: boolean;
  /**
   * Full-screen ChatGPT-style editable canvas for text/markdown files.
   * Independent of the Computer sheet.
   */
  readonly canvasOpen: boolean;
  /** Origin rect for the expand animation; cleared after close. */
  readonly canvasOrigin: CanvasOrigin | null;
  openFile: (args: {
    readonly id?: string;
    readonly path: string;
    readonly content: string;
    readonly version?: number;
    readonly running?: boolean;
    readonly note?: string | null;
    readonly dirty?: boolean;
    /** Open the editable canvas when the path is text/markdown. Default true. */
    readonly openCanvas?: boolean;
    /** Writing-card rect for ChatGPT-style expand. */
    readonly origin?: CanvasOrigin;
  }) => void;
  /** Open a workspace path; tries the native viewer, then the in-app reader/canvas. */
  openPath: (path: string, content?: string) => Promise<void>;
  /**
   * Claim or refresh a tab from a live write_file stream.
   * Does not auto-present the full-screen canvas — the inline Writing card
   * stays in the thread until the user opens it.
   */
  openOrClaimWrite: (args: {
    readonly id?: string;
    readonly path: string;
    readonly content: string;
    readonly running: boolean;
    readonly note?: string | null;
    /** When true, present the editable canvas (user gesture). Default false. */
    readonly openCanvas?: boolean;
  }) => void;
  /** Patch an open file tab (user edit or agent settle). */
  updateFile: (args: {
    readonly id?: string;
    readonly path?: string;
    readonly content?: string;
    readonly running?: boolean;
    readonly note?: string | null;
    readonly dirty?: boolean;
    readonly version?: number;
  }) => void;
  /** Apply edit_file old→new on an open tab by path. */
  applyEditPatch: (
    path: string,
    oldText: string,
    newText: string,
  ) => void;
  /** Persist the active (or named) file tab to the chat files API. */
  saveFile: (path?: string) => Promise<boolean>;
  openBrowserPages: (pages: readonly BrowserTabInfo[]) => void;
  selectWorkspaceTab: (tabId: string) => void;
  closeWorkspaceTab: (tabId: string) => void;
  closeWorkspace: () => void;
  closeCanvas: () => void;
  setControlMode: (mode: BrowserControlMode) => void;
  ensureViewUrl: () => Promise<void>;
  setChatId: (chatId: string | null) => void;
  clearPreferDetail: () => void;
  requestDetail: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function authHeaders(): Record<string, string> {
  const credential = getAuthCookie();
  return {
    "content-type": "application/json",
    ...(credential ? { authorization: `Bearer ${credential}` } : {}),
  };
}

function fileTabByPath(
  state: WorkspaceState,
  path: string,
): WorkspaceFileTab | null {
  const tab = state.tabs.find(
    (entry): entry is WorkspaceFileTab =>
      entry.kind === "file" && entry.path === path,
  );
  return tab ?? null;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<WorkspaceState>(emptyWorkspace);
  const [controlMode, setControlMode] = useState<BrowserControlMode>("agent");
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [preferDetail, setPreferDetail] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [canvasOrigin, setCanvasOrigin] = useState<CanvasOrigin | null>(null);

  const openFile = useCallback(
    (args: {
      readonly id?: string;
      readonly path: string;
      readonly content: string;
      readonly version?: number;
      readonly running?: boolean;
      readonly note?: string | null;
      readonly dirty?: boolean;
      readonly openCanvas?: boolean;
      readonly origin?: CanvasOrigin;
    }) => {
      setWorkspace((prev) =>
        openFileTab(prev, {
          id: args.id ?? `ref:${args.path}`,
          path: args.path,
          content: args.content,
          running: args.running ?? false,
          note: args.note ?? null,
          version: args.version ?? 1,
          dirty: args.dirty ?? false,
        }),
      );
      const useCanvas =
        (args.openCanvas ?? true) && isEditableCanvasPath(args.path);
      if (useCanvas) {
        setCanvasOrigin(args.origin ?? null);
        setCanvasOpen(true);
        setPreferDetail(false);
      } else {
        setPreferDetail(true);
      }
    },
    [],
  );

  const openOrClaimWrite = useCallback(
    (args: {
      readonly id?: string;
      readonly path: string;
      readonly content: string;
      readonly running: boolean;
      readonly note?: string | null;
      readonly openCanvas?: boolean;
    }) => {
      setWorkspace((prev) => {
        const existing = fileTabByPath(prev, args.path);
        // While the agent is writing it owns the buffer. After settle, leave
        // dirty user edits alone until the next running claim.
        if (existing?.dirty && !args.running) {
          return updateFileTabByPath(prev, args.path, (tab) => ({
            ...tab,
            running: false,
            note: args.note ?? tab.note,
            version: tab.version + (args.running ? 0 : 1),
          }));
        }
        return openFileTab(prev, {
          id: args.id ?? existing?.id ?? `ref:${args.path}`,
          path: args.path,
          content: args.content,
          running: args.running,
          note: args.note ?? null,
          version: (existing?.version ?? 0) + (args.running ? 0 : 1),
          dirty: false,
        });
      });
      if (args.openCanvas && isEditableCanvasPath(args.path)) {
        setCanvasOpen(true);
        setPreferDetail(false);
      }
    },
    [],
  );

  const updateFile = useCallback(
    (args: {
      readonly id?: string;
      readonly path?: string;
      readonly content?: string;
      readonly running?: boolean;
      readonly note?: string | null;
      readonly dirty?: boolean;
      readonly version?: number;
    }) => {
      setWorkspace((prev) => {
        if (args.id) {
          return updateFileTab(prev, args.id, {
            ...(args.content !== undefined ? { content: args.content } : {}),
            ...(args.running !== undefined ? { running: args.running } : {}),
            ...(args.note !== undefined ? { note: args.note } : {}),
            ...(args.dirty !== undefined ? { dirty: args.dirty } : {}),
            ...(args.version !== undefined ? { version: args.version } : {}),
            ...(args.path !== undefined ? { path: args.path } : {}),
          });
        }
        if (args.path) {
          return updateFileTabByPath(prev, args.path, (tab) => ({
            ...tab,
            ...(args.content !== undefined ? { content: args.content } : {}),
            ...(args.running !== undefined ? { running: args.running } : {}),
            ...(args.note !== undefined ? { note: args.note } : {}),
            ...(args.dirty !== undefined ? { dirty: args.dirty } : {}),
            ...(args.version !== undefined ? { version: args.version } : {}),
          }));
        }
        const active = activeFileTab(prev);
        if (!active) return prev;
        return updateFileTab(prev, active.id, {
          ...(args.content !== undefined ? { content: args.content } : {}),
          ...(args.running !== undefined ? { running: args.running } : {}),
          ...(args.note !== undefined ? { note: args.note } : {}),
          ...(args.dirty !== undefined ? { dirty: args.dirty } : {}),
          ...(args.version !== undefined ? { version: args.version } : {}),
        });
      });
    },
    [],
  );

  const applyEditPatch = useCallback(
    (path: string, oldText: string, newText: string) => {
      setWorkspace((prev) =>
        updateFileTabByPath(prev, path, (tab) => {
          if (tab.dirty) return tab;
          if (!tab.content.includes(oldText)) return tab;
          return {
            ...tab,
            content: tab.content.replace(oldText, newText),
            dirty: false,
            version: tab.version + 1,
            running: false,
          };
        }),
      );
    },
    [],
  );

  const openPath = useCallback(
    async (path: string, content?: string) => {
      let text = content;
      if (text === undefined) {
        if (!chatId) return;
        const fetched = await fetchChatFileContent(chatId, path);
        if (fetched == null) return;
        text = fetched;
      }

      if (isEditableCanvasPath(path)) {
        openFile({
          id: `ref:${path}`,
          path,
          content: text,
          openCanvas: true,
        });
        return;
      }

      const openedNative = await previewWorkspaceFile({ path, content: text });
      if (openedNative) return;

      openFile({
        id: `ref:${path}`,
        path,
        content: text,
        openCanvas: false,
      });
    },
    [chatId, openFile],
  );

  const saveFile = useCallback(
    async (path?: string) => {
      if (!chatId) return false;
      const tab = path
        ? fileTabByPath(workspace, path)
        : activeFileTab(workspace);
      if (!tab) return false;
      const ok = await saveChatFile(chatId, tab.path, tab.content);
      if (ok) {
        setWorkspace((prev) =>
          updateFileTabByPath(prev, tab.path, (entry) => ({
            ...entry,
            dirty: false,
          })),
        );
      }
      return ok;
    },
    [chatId, workspace],
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
    setWorkspace((prev) => {
      const next = selectTab(prev, tabId);
      const tab = next.tabs.find((entry) => entry.id === tabId);
      if (tab?.kind === "file" && isEditableCanvasPath(tab.path)) {
        setCanvasOpen(true);
        setPreferDetail(false);
      } else {
        setPreferDetail(true);
      }
      return next;
    });
  }, []);

  const closeWorkspaceTab = useCallback((tabId: string) => {
    setWorkspace((prev) => {
      const next = closeTab(prev, tabId);
      if (next.tabs.length === 0) {
        setCanvasOpen(false);
      }
      return next;
    });
  }, []);

  const closeWorkspace = useCallback(() => {
    setWorkspace(emptyWorkspace());
    setCanvasOpen(false);
  }, []);

  const closeCanvas = useCallback(() => {
    setCanvasOpen(false);
    setCanvasOrigin(null);
  }, []);

  const clearPreferDetail = useCallback(() => {
    setPreferDetail(false);
  }, []);

  const requestDetail = useCallback(() => {
    setPreferDetail(true);
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

  const activeFile = useMemo(() => activeFileTab(workspace), [workspace]);

  const value = useMemo(
    () => ({
      workspace,
      tabs: workspace.tabs,
      activeTabId: workspace.activeTabId,
      activeFile,
      open: workspace.tabs.length > 0,
      controlMode,
      viewUrl,
      chatId,
      preferDetail,
      canvasOpen,
      canvasOrigin,
      openFile,
      openPath,
      openOrClaimWrite,
      updateFile,
      applyEditPatch,
      saveFile,
      openBrowserPages,
      selectWorkspaceTab,
      closeWorkspaceTab,
      closeWorkspace,
      closeCanvas,
      setControlMode,
      ensureViewUrl,
      setChatId,
      clearPreferDetail,
      requestDetail,
    }),
    [
      workspace,
      activeFile,
      controlMode,
      viewUrl,
      chatId,
      preferDetail,
      canvasOpen,
      canvasOrigin,
      openFile,
      openPath,
      openOrClaimWrite,
      updateFile,
      applyEditPatch,
      saveFile,
      openBrowserPages,
      selectWorkspaceTab,
      closeWorkspaceTab,
      closeWorkspace,
      closeCanvas,
      ensureViewUrl,
      clearPreferDetail,
      requestDetail,
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
