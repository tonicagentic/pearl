import {
  useCallback,
  useEffect,
  useMemo,
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
  ChevronLeftIcon,
  GlobeIcon,
  MonitorIcon,
} from "lucide-react-native";

import { FilePreviewCard } from "@/components/assistant-ui/elements/file-preview-card";
import { Icon } from "@/components/ui/icon";
import { WorkspacePanel } from "@/components/workspace-screen";

import {
  fetchComputerState,
  type AgentFileMeta,
  type ComputerState,
} from "@/src/chats-client";
import { useChats } from "@/src/chat-context";
import { AGENT_URL, getAuthCookie } from "@/src/eve-transport";
import { useWorkspace } from "@/src/workspace-context";

const HEARTBEAT_MS = 5000;

type DetailKind = "overview" | "workspace";

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
export function ComputerPanel({
  topInset = 0,
  visible = true,
}: {
  readonly topInset?: number;
  /** False while Chat is selected — pauses heartbeat. */
  readonly visible?: boolean;
}) {
  const { activeChatId } = useChats();
  const {
    tabs,
    chatId,
    preferDetail,
    openPath,
    openBrowserPages,
    selectWorkspaceTab,
    setControlMode,
    ensureViewUrl,
    clearPreferDetail,
  } = useWorkspace();

  const [mode, setMode] = useState<DetailKind>("overview");
  const [remote, setRemote] = useState<ComputerState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingPath, setOpeningPath] = useState<string | null>(null);

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
        await openPath(path, content ?? undefined);
        // Native preview returns without a tab. In-app opens set preferDetail.
      } finally {
        setOpeningPath(null);
      }
    },
    [openPath],
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

  const idleEmpty =
    !loading &&
    !error &&
    fileCards.length === 0 &&
    pageTabs.length === 0;

  return (
    <View className="bg-background flex-1" style={{ paddingTop: topInset }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-4 mt-2 flex-row items-center gap-2">
          <Icon as={MonitorIcon} className="text-foreground size-5" />
          <Text className="text-foreground text-lg font-semibold">Computer</Text>
          {loading ? <ActivityIndicator size="small" /> : null}
        </View>

        {error ? (
          <Text className="text-destructive mb-4 text-sm">{error}</Text>
        ) : null}

        {idleEmpty ? (
          <Text className="text-muted-foreground mb-6 text-sm leading-5">
            Files and browser windows show up here as Pearl works on this chat.
          </Text>
        ) : null}

        <Section title="Files">
          {fileCards.length === 0 ? (
            <Text className="text-muted-foreground text-sm">
              No files yet.
            </Text>
          ) : (
            <View className="gap-2">
              {fileCards.map((file) => (
                <View key={"id" in file ? file.id : file.path}>
                  <FilePreviewCard
                    path={file.path}
                    onOpen={(path, content) => {
                      void openFileRow(path, content);
                    }}
                  />
                  {openingPath === file.path ? (
                    <ActivityIndicator className="mt-2" size="small" />
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </Section>

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
