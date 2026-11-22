import type {
  WorkspaceDesktopTab,
  WorkspaceFileTab,
  WorkspaceLibraryTab,
  WorkspacePageTab,
  WorkspaceState,
  WorkspaceTab,
} from "./types.ts";

export const DESKTOP_TAB_ID = "desktop:main";
export const LIBRARY_TAB_ID = "library:main";

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

/** Open or focus the screen-relay desktop tab. */
export function openDesktopTab(
  state: WorkspaceState,
  title = "Desktop",
): WorkspaceState {
  const existing = state.tabs.findIndex((tab) => tab.kind === "desktop");
  if (existing >= 0) {
    const prev = state.tabs[existing] as WorkspaceDesktopTab;
    const next: WorkspaceDesktopTab = { ...prev, title };
    const tabs = state.tabs.map((tab, i) => (i === existing ? next : tab));
    return { tabs, activeTabId: next.id };
  }
  const tab: WorkspaceDesktopTab = {
    kind: "desktop",
    id: DESKTOP_TAB_ID,
    title,
  };
  return { tabs: [...state.tabs, tab], activeTabId: tab.id };
}

/** Open or focus the single library browser tab. */
export function openLibraryTab(
  state: WorkspaceState,
  title = "Library",
): WorkspaceState {
  const existing = state.tabs.findIndex((tab) => tab.kind === "library");
  if (existing >= 0) {
    const prev = state.tabs[existing] as WorkspaceLibraryTab;
    const next: WorkspaceLibraryTab = { ...prev, title };
    const tabs = state.tabs.map((tab, i) => (i === existing ? next : tab));
    return { tabs, activeTabId: next.id };
  }
  const tab: WorkspaceLibraryTab = {
    kind: "library",
    id: LIBRARY_TAB_ID,
    title,
  };
  return { tabs: [...state.tabs, tab], activeTabId: tab.id };
}

/**
 * Focus a page tab that already shows `url`, or open a provisional page tab
 * until the control server assigns a real pageId.
 */
export function openOrFocusPageByUrl(
  state: WorkspaceState,
  url: string,
  title?: string,
): WorkspaceState {
  const existing = state.tabs.find(
    (tab) => tab.kind === "page" && tab.url === url,
  );
  if (existing) {
    return selectTab(state, existing.id);
  }
  const pageId = `local:${url}`;
  return openPageTab(state, {
    pageId,
    url,
    title: title || url || "Page",
  });
}

/**
 * Replace page tabs with the live Chromium tab list; keep file, desktop, and
 * library tabs. When the server marks a page active, focus it so agent
 * navigations surface even if a file tab was selected.
 */
export function syncPageTabs(
  state: WorkspaceState,
  pages: readonly SyncPageInput[],
  options?: { readonly focusActivePage?: boolean },
): WorkspaceState {
  const files = state.tabs.filter(
    (tab): tab is WorkspaceFileTab => tab.kind === "file",
  );
  const desktop = state.tabs.filter(
    (tab): tab is WorkspaceDesktopTab => tab.kind === "desktop",
  );
  const library = state.tabs.filter(
    (tab): tab is WorkspaceLibraryTab => tab.kind === "library",
  );
  const pageTabs: WorkspacePageTab[] = pages.map((page) => ({
    kind: "page",
    id: `page:${page.pageId}`,
    pageId: page.pageId,
    url: page.url,
    title: page.title,
  }));
  const tabs: WorkspaceTab[] = [...files, ...desktop, ...library, ...pageTabs];
  const activeFromServer = pages.find((page) => page.active);
  const focusActivePage = options?.focusActivePage !== false;

  let activeTabId: string | null = null;
  if (focusActivePage && activeFromServer) {
    activeTabId = `page:${activeFromServer.pageId}`;
  } else if (tabs.some((tab) => tab.id === state.activeTabId)) {
    activeTabId = state.activeTabId;
  } else if (activeFromServer) {
    activeTabId = `page:${activeFromServer.pageId}`;
  } else if (pageTabs[0]) {
    activeTabId = pageTabs[0].id;
  } else if (library[0]) {
    activeTabId = library[0].id;
  } else if (desktop[0]) {
    activeTabId = desktop[0].id;
  } else if (files[0]) {
    activeTabId = files[0].id;
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
