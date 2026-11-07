import type {
  WorkspaceFileTab,
  WorkspacePageTab,
  WorkspaceState,
  WorkspaceTab,
} from "./types.ts";

export function emptyWorkspace(): WorkspaceState {
  return { tabs: [], activeTabId: null };
}

export function activeTab(state: WorkspaceState): WorkspaceTab | null {
  if (!state.activeTabId) return null;
  return state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;
}

export function activeFileTab(state: WorkspaceState): WorkspaceFileTab | null {
  const tab = activeTab(state);
  return tab?.kind === "file" ? tab : null;
}

export function openFileTab(
  state: WorkspaceState,
  file: Omit<WorkspaceFileTab, "kind">,
): WorkspaceState {
  const existing = state.tabs.findIndex(
    (tab) =>
      tab.kind === "file" && (tab.id === file.id || tab.path === file.path),
  );
  if (existing >= 0) {
    const prev = state.tabs[existing] as WorkspaceFileTab;
    const next: WorkspaceFileTab = {
      ...prev,
      ...file,
      kind: "file",
      id: prev.id,
    };
    const tabs = state.tabs.map((tab, i) => (i === existing ? next : tab));
    return { tabs, activeTabId: next.id };
  }
  const tab: WorkspaceFileTab = { kind: "file", ...file };
  return { tabs: [...state.tabs, tab], activeTabId: tab.id };
}

export function updateFileTab(
  state: WorkspaceState,
  id: string,
  patch: Partial<Omit<WorkspaceFileTab, "kind" | "id">>,
): WorkspaceState {
  return {
    ...state,
    tabs: state.tabs.map((tab) =>
      tab.kind === "file" && tab.id === id ? { ...tab, ...patch } : tab,
    ),
  };
}

export function updateFileTabByPath(
  state: WorkspaceState,
  path: string,
  update: (tab: WorkspaceFileTab) => WorkspaceFileTab,
): WorkspaceState {
  return {
    ...state,
    tabs: state.tabs.map((tab) =>
      tab.kind === "file" && tab.path === path ? update(tab) : tab,
    ),
  };
}

export function openPageTab(
  state: WorkspaceState,
  page: Omit<WorkspacePageTab, "kind" | "id"> & { readonly id?: string },
): WorkspaceState {
  const id = page.id ?? `page:${page.pageId}`;
  const existing = state.tabs.findIndex(
    (tab) => tab.kind === "page" && tab.pageId === page.pageId,
  );
  if (existing >= 0) {
    const prev = state.tabs[existing] as WorkspacePageTab;
    const next: WorkspacePageTab = {
      ...prev,
      url: page.url,
      title: page.title,
      pageId: page.pageId,
    };
    const tabs = state.tabs.map((tab, i) => (i === existing ? next : tab));
    return { tabs, activeTabId: next.id };
  }
  const tab: WorkspacePageTab = {
    kind: "page",
    id,
    pageId: page.pageId,
    url: page.url,
    title: page.title,
  };
  return { tabs: [...state.tabs, tab], activeTabId: tab.id };
}

type SyncPageInput = Omit<WorkspacePageTab, "kind" | "id"> & {
  readonly active?: boolean;
};

/** Replace page tabs with the live Chromium tab list; keep file tabs. */
export function syncPageTabs(
  state: WorkspaceState,
  pages: readonly SyncPageInput[],
): WorkspaceState {
  const files = state.tabs.filter(
    (tab): tab is WorkspaceFileTab => tab.kind === "file",
  );
  const pageTabs: WorkspacePageTab[] = pages.map((page) => ({
    kind: "page",
    id: `page:${page.pageId}`,
    pageId: page.pageId,
    url: page.url,
    title: page.title,
  }));
  const tabs: WorkspaceTab[] = [...files, ...pageTabs];
  const activeStillOpen = tabs.some((tab) => tab.id === state.activeTabId);
  // Prefer keeping the current selection; otherwise focus the active Chromium
  // page, then the first page tab, then the first file.
  let activeTabId = activeStillOpen ? state.activeTabId : null;
  if (!activeTabId) {
    const activeFromServer = pages.find((page) => page.active);
    if (activeFromServer) {
      activeTabId = `page:${activeFromServer.pageId}`;
    } else if (pageTabs[0]) {
      activeTabId = pageTabs[0].id;
    } else if (files[0]) {
      activeTabId = files[0].id;
    }
  }
  return { tabs, activeTabId };
}

export function selectTab(
  state: WorkspaceState,
  tabId: string,
): WorkspaceState {
  if (!state.tabs.some((tab) => tab.id === tabId)) return state;
  return { ...state, activeTabId: tabId };
}

export function closeTab(
  state: WorkspaceState,
  tabId: string,
): WorkspaceState {
  const index = state.tabs.findIndex((tab) => tab.id === tabId);
  if (index < 0) return state;
  const tabs = state.tabs.filter((tab) => tab.id !== tabId);
  if (tabs.length === 0) {
    return { tabs: [], activeTabId: null };
  }
  if (state.activeTabId !== tabId) {
    return { tabs, activeTabId: state.activeTabId };
  }
  const neighbor = tabs[Math.min(index, tabs.length - 1)];
  return { tabs, activeTabId: neighbor?.id ?? null };
}

export function closeActiveTab(state: WorkspaceState): WorkspaceState {
  if (!state.activeTabId) return state;
  return closeTab(state, state.activeTabId);
}
