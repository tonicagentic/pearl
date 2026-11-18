import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderTreeIcon,
  GlobeIcon,
} from "lucide-react-native";

import { Icon } from "@/components/ui/icon";
import { WorkspacePanel } from "@/components/workspace-screen";

import {
  fetchComputerState,
  type AgentFileMeta,
  type ComputerState,
} from "@/src/chats-client";
import { useChats } from "@/src/chat-context";
import { fetchChatFileContent } from "@/src/chat-files";
import { AGENT_URL, getAuthCookie } from "@/src/eve-transport";
import { useWorkspace } from "@/src/workspace-context";
import { isEditableCanvasPath } from "../../lib/design/file-preview";

const HEARTBEAT_MS = 5000;

type DetailKind = "overview" | "workspace" | "files-tree";

type ComputerLocation = {
  readonly mode: DetailKind;
  readonly expandedFolders: readonly string[];
};

/** In-memory Computer drill-in location, keyed by chat id. */
const locationByChatId = new Map<string, ComputerLocation>();

function readLocation(chatId: string | null | undefined): ComputerLocation {
  if (!chatId) return { mode: "overview", expandedFolders: [] };
  return (
    locationByChatId.get(chatId) ?? {
      mode: "overview",
      expandedFolders: [],
    }
  );
}

type PathTreeNode = {
  readonly name: string;
  readonly path: string;
  readonly kind: "file" | "folder";
  readonly children?: readonly PathTreeNode[];
};

type MutablePathNode = {
  name: string;
  path: string;
  kind: "file" | "folder";
  children?: Map<string, MutablePathNode>;
};

/** Nested folder/file tree from workspace paths (`a/b/c.md`). */
function buildPathTree(paths: readonly string[]): PathTreeNode[] {
  const root = new Map<string, MutablePathNode>();

  for (const full of [...paths].sort((a, b) => a.localeCompare(b))) {
    const parts = full.split("/").filter(Boolean);
    if (parts.length === 0) continue;
    let level = root;
    let prefix = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      prefix = prefix ? `${prefix}/${part}` : part;
      const isFile = i === parts.length - 1;
      let node = level.get(part);
      if (!node) {
        node = {
          name: part,
          path: prefix,
          kind: isFile ? "file" : "folder",
          children: isFile ? undefined : new Map(),
        };
        level.set(part, node);
      } else if (!isFile && node.kind === "file") {
        node.kind = "folder";
        node.children = new Map();
      }
      if (!isFile) {
        if (!node.children) node.children = new Map();
        level = node.children;
      }
    }
  }

  const toList = (map: Map<string, MutablePathNode>): PathTreeNode[] =>
    [...map.values()]
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((node) => ({
        name: node.name,
        path: node.path,
        kind: node.kind,
        children: node.children ? toList(node.children) : undefined,
      }));

  return toList(root);
}

function collectFolderPaths(nodes: readonly PathTreeNode[]): string[] {
  const out: string[] = [];
  for (const node of nodes) {
    if (node.kind === "folder") {
      out.push(node.path);
      if (node.children) out.push(...collectFolderPaths(node.children));
    }
  }
  return out;
}

function authHeaders(): Record<string, string> {
  const credential = getAuthCookie();
  return {
    "content-type": "application/json",
    ...(credential ? { authorization: `Bearer ${credential}` } : {}),
  };
}

/**
 * Computer pane: files on this chat’s machine and open browser windows,
 * with drill-in to the workspace reader / browser.
 */
export type ComputerEditableOpen = {
  readonly id?: string;
  readonly path: string;
  readonly content: string;
};

export function ComputerPanel({
  topInset = 0,
  visible = true,
  onOpenEditableFile,
}: {
  readonly topInset?: number;
  /** False while Chat is selected — pauses heartbeat. */
  readonly visible?: boolean;
  /**
   * Host dismisses the Computer sheet, then opens FileCanvas after the sheet
   * has closed (iOS drops RN Modals presented mid-dismiss).
   */
  readonly onOpenEditableFile?: (file: ComputerEditableOpen) => void;
}) {
  const { activeChatId } = useChats();
  const {
    tabs,
    chatId,
    preferDetail,
    openFile,
    openPath,
    openBrowserPages,
    selectWorkspaceTab,
    setControlMode,
    ensureViewUrl,
    clearPreferDetail,
  } = useWorkspace();

  const [mode, setMode] = useState<DetailKind>(
    () => readLocation(activeChatId).mode,
  );
  const [remote, setRemote] = useState<ComputerState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<ReadonlySet<string>>(
    () => new Set(readLocation(activeChatId).expandedFolders),
  );
  const locationChatRef = useRef(activeChatId);

  // Restore this thread's Computer section when the active chat changes
  // (ChatScreen stays mounted across thread switches).
  useEffect(() => {
    if (locationChatRef.current === activeChatId) return;
    locationChatRef.current = activeChatId;
    const location = readLocation(activeChatId);
    setMode(location.mode);
    setExpandedFolders(new Set(location.expandedFolders));
  }, [activeChatId]);

  // Remember overview / files-tree / workspace (+ folder expand) per thread.
  useEffect(() => {
    if (!activeChatId) return;
    // Don't clobber the saved location while we're mid-switch restore.
    if (locationChatRef.current !== activeChatId) return;
    locationByChatId.set(activeChatId, {
      mode,
      expandedFolders: [...expandedFolders],
    });
  }, [activeChatId, mode, expandedFolders]);

  const pageTabs = useMemo(
    () => tabs.filter((tab) => tab.kind === "page"),
    [tabs],
  );
  const fileTabs = useMemo(
    () => tabs.filter((tab) => tab.kind === "file"),
    [tabs],
  );

  const browserActive =
    Boolean(remote?.browser.active) || pageTabs.length > 0;

  const files = remote?.files ?? [];

  // Saved files plus any open file tabs not yet in the remote list.
  const fileCards = useMemo(() => {
    const byPath = new Map<string, AgentFileMeta | { path: string }>();
    for (const file of files) {
      byPath.set(file.path, file);
    }
    for (const tab of fileTabs) {
      if (!byPath.has(tab.path)) {
        byPath.set(tab.path, { path: tab.path });
      }
    }
    return [...byPath.values()];
  }, [files, fileTabs]);

  const pathTree = useMemo(
    () => buildPathTree(fileCards.map((file) => file.path)),
    [fileCards],
  );

  // Expand every folder the first time the tree is shown / when new folders appear.
  useEffect(() => {
    if (mode !== "files-tree") return;
    const folders = collectFolderPaths(pathTree);
    setExpandedFolders((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const path of folders) {
        if (!next.has(path)) {
          next.add(path);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [mode, pathTree]);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const refreshRemote = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchComputerState(id);
      setRemote(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load computer state.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible || !activeChatId) {
      setRemote(null);
      setError(null);
      return;
    }
    void refreshRemote(activeChatId);
  }, [activeChatId, refreshRemote, visible]);

  // Chat-launched opens request the workspace reader.
  useEffect(() => {
    if (!preferDetail) return;
    setMode("workspace");
    clearPreferDetail();
  }, [preferDetail, clearPreferDetail]);

  // Heartbeat while Computer is visible and a browser session may exist.
  useEffect(() => {
    if (!visible || !chatId || !browserActive) return;

    let cancelled = false;

    const beat = async () => {
      try {
        const res = await fetch(
          `${AGENT_URL}/api/chats/${encodeURIComponent(chatId)}/browser`,
          {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ op: "heartbeat" }),
          },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          controlMode?: "agent" | "user";
          tabs?: readonly {
            id: string;
            url: string;
            title: string;
            active: boolean;
          }[];
        };
        if (data.controlMode === "agent" || data.controlMode === "user") {
          setControlMode(data.controlMode);
        }
        if (data.tabs) {
          openBrowserPages(data.tabs);
        }
        void ensureViewUrl();
      } catch {
        // Keep last known tabs on transient heartbeat failures.
      }
    };

    void beat();
    const timer = setInterval(() => {
      void beat();
    }, HEARTBEAT_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [
    browserActive,
    chatId,
    ensureViewUrl,
    openBrowserPages,
    setControlMode,
    visible,
  ]);

  const openFileRow = useCallback(
    async (path: string, content?: string | null) => {
      setOpeningPath(path);
      try {
        const tab = fileTabs.find((entry) => entry.path === path);
        let text = content ?? tab?.content ?? undefined;

        if (isEditableCanvasPath(path)) {
          if (text === undefined) {
            if (chatId) {
              const fetched = await fetchChatFileContent(chatId, path);
              text = fetched ?? tab?.content ?? "";
            } else {
              text = tab?.content ?? "";
            }
          }
          const payload: ComputerEditableOpen = {
            id: tab?.id ?? `ref:${path}`,
            path,
            content: text,
          };
          if (onOpenEditableFile) {
            onOpenEditableFile(payload);
          } else {
            openFile({ ...payload, openCanvas: true });
          }
          return;
        }

        await openPath(path, text);
        // Native preview returns without a tab. In-app opens set preferDetail.
      } finally {
        setOpeningPath(null);
      }
    },
    [chatId, fileTabs, onOpenEditableFile, openFile, openPath],
  );

  const openPageRow = useCallback(
    (tabId: string) => {
      selectWorkspaceTab(tabId);
      void ensureViewUrl();
      setMode("workspace");
    },
    [ensureViewUrl, selectWorkspaceTab],
  );

  if (mode === "workspace") {
    return (
      <View className="bg-background flex-1" style={{ paddingTop: topInset }}>
        <View className="border-border/60 flex-row items-center gap-1 border-b px-1 py-1">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Computer"
            className="min-h-11 flex-row items-center gap-1 px-2"
            onPress={() => setMode("overview")}
          >
            <Icon as={ChevronLeftIcon} className="text-foreground size-5" />
            <Text className="text-foreground text-sm font-medium">Computer</Text>
          </Pressable>
        </View>
        <WorkspacePanel topInset={0} />
      </View>
    );
  }

  if (mode === "files-tree") {
    return (
      <View className="flex-1" style={{ paddingTop: topInset }}>
        <View className="border-border/60 flex-row items-center gap-1 border-b px-1 py-1">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Computer"
            className="min-h-11 flex-row items-center gap-1 px-2"
            onPress={() => setMode("overview")}
          >
            <Icon as={ChevronLeftIcon} className="text-foreground size-5" />
            <Text className="text-foreground text-sm font-medium">Computer</Text>
          </Pressable>
          <Text
            className="text-foreground flex-1 text-center text-sm font-medium"
            numberOfLines={1}
          >
            Workspace files
          </Text>
          <View className="w-11" />
        </View>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {pathTree.length === 0 ? (
            <Text className="text-muted-foreground mt-4 px-2 text-sm">
              No files yet.
            </Text>
          ) : (
            <View className="mt-2">
              {pathTree.map((node) => (
                <PathTreeRows
                  key={node.path}
                  node={node}
                  depth={0}
                  expandedFolders={expandedFolders}
                  openingPath={openingPath}
                  onToggleFolder={toggleFolder}
                  onOpenFile={(path) => {
                    void openFileRow(path);
                  }}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  const idleEmpty =
    !loading &&
    !error &&
    fileCards.length === 0 &&
    pageTabs.length === 0;

  return (
    <View className="flex-1" style={{ paddingTop: topInset }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {loading ? (
          <ActivityIndicator className="mb-4 mt-1" size="small" />
        ) : null}

        {error ? (
          <Text className="text-destructive mb-4 text-sm">{error}</Text>
        ) : null}

        {idleEmpty ? (
          <Text className="text-muted-foreground mb-6 mt-1 text-sm leading-5">
            Files and browser windows show up here as Pearl works on this chat.
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Browse workspace files"
          className="border-border/50 bg-card mb-5 flex-row items-center gap-3 rounded-2xl border px-3.5 py-3"
          onPress={() => setMode("files-tree")}
        >
          <View className="bg-foreground/5 size-9 items-center justify-center rounded-xl">
            <Icon as={FolderTreeIcon} className="text-foreground size-4" />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-foreground text-sm font-medium">
              Workspace files
            </Text>
            <Text className="text-muted-foreground mt-0.5 text-xs">
              {fileCards.length === 0
                ? "Browse the file tree"
                : `${fileCards.length} file${fileCards.length === 1 ? "" : "s"}`}
            </Text>
          </View>
          <Icon
            as={ChevronRightIcon}
            className="text-muted-foreground size-4"
          />
        </Pressable>

        <Section title="Browser windows">
          {pageTabs.length === 0 ? (
            <Text className="text-muted-foreground text-sm">
              No open browser windows.
            </Text>
          ) : (
            pageTabs.map((tab) => (
              <Pressable
                key={tab.id}
                accessibilityRole="button"
                className="border-border/50 mb-2 rounded-xl border px-3 py-3"
                onPress={() => openPageRow(tab.id)}
              >
                <View className="flex-row items-center gap-2">
                  <Icon as={GlobeIcon} className="text-muted-foreground size-4" />
                  <Text
                    numberOfLines={1}
                    className="text-foreground flex-1 text-sm font-medium"
                  >
                    {tab.title || tab.url}
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  className="text-muted-foreground mt-1 text-xs"
                >
                  {tab.url}
                </Text>
              </Pressable>
            ))
          )}
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <View className="mb-6">
      <Text className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
        {title}
      </Text>
      {children}
    </View>
  );
}

function PathTreeRows({
  node,
  depth,
  expandedFolders,
  openingPath,
  onToggleFolder,
  onOpenFile,
}: {
  readonly node: PathTreeNode;
  readonly depth: number;
  readonly expandedFolders: ReadonlySet<string>;
  readonly openingPath: string | null;
  readonly onToggleFolder: (path: string) => void;
  readonly onOpenFile: (path: string) => void;
}) {
  const expanded = node.kind === "folder" && expandedFolders.has(node.path);
  const pad = 8 + depth * 14;

  if (node.kind === "folder") {
    return (
      <View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${expanded ? "Collapse" : "Expand"} ${node.name}`}
          accessibilityState={{ expanded }}
          className="min-h-11 flex-row items-center gap-2 py-1.5"
          style={{ paddingLeft: pad }}
          onPress={() => onToggleFolder(node.path)}
        >
          <Icon
            as={expanded ? ChevronDownIcon : ChevronRightIcon}
            className="text-muted-foreground size-3.5"
          />
          <Icon
            as={expanded ? FolderOpenIcon : FolderIcon}
            className="text-muted-foreground size-4"
          />
          <Text
            numberOfLines={1}
            className="text-foreground min-w-0 flex-1 text-sm font-medium"
          >
            {node.name}
          </Text>
        </Pressable>
        {expanded
          ? node.children?.map((child) => (
              <PathTreeRows
                key={child.path}
                node={child}
                depth={depth + 1}
                expandedFolders={expandedFolders}
                openingPath={openingPath}
                onToggleFolder={onToggleFolder}
                onOpenFile={onOpenFile}
              />
            ))
          : null}
      </View>
    );
  }

  const opening = openingPath === node.path;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${node.name}`}
      accessibilityState={{ disabled: opening }}
      disabled={opening}
      className="min-h-11 flex-row items-center gap-2 py-1.5"
      style={{ paddingLeft: pad + 18 }}
      onPress={() => onOpenFile(node.path)}
    >
      <Icon as={FileIcon} className="text-muted-foreground size-4" />
      <Text
        numberOfLines={1}
        className="text-foreground min-w-0 flex-1 text-sm"
      >
        {node.name}
      </Text>
      {opening ? <ActivityIndicator size="small" /> : null}
    </Pressable>
  );
}
