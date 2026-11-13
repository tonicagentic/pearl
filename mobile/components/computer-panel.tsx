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
  FileTextIcon,
  GlobeIcon,
  MonitorIcon,
  TerminalIcon,
} from "lucide-react-native";

import { Icon } from "@/components/ui/icon";
import { WorkspacePanel } from "@/components/workspace-screen";
import type { SessionStreamEvent } from "eve/client";

import { chatNeedsUserInput } from "../../lib/chat/events";
import { useChats, useEveEvents } from "@/src/chat-context";
import {
  fetchComputerState,
  type AgentFileMeta,
  type ComputerState,
} from "@/src/chats-client";
import { AGENT_URL, getAuthCookie } from "@/src/eve-transport";
import { openWebUrl } from "@/src/open-web-url";
import { deriveSubagentRuns } from "@/src/subagent-runs";
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

function basename(path: string): string {
  return path.split("/").pop() || path;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Chat | Computer pane: session / environments / browsers / files overview,
 * with drill-in to the existing workspace preview.
 */
export function ComputerPanel({
  topInset = 0,
  visible = true,
}: {
  readonly topInset?: number;
  /** False while Chat is selected — pauses heartbeat. */
  readonly visible?: boolean;
}) {
  const { store, activeChatId } = useChats();
  const events = useEveEvents();
  const {
    tabs,
    chatId,
    controlMode,
    openPath,
    openBrowserPages,
    selectWorkspaceTab,
    setControlMode,
    ensureViewUrl,
  } = useWorkspace();

  const [mode, setMode] = useState<DetailKind>("overview");
  const [remote, setRemote] = useState<ComputerState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingPath, setOpeningPath] = useState<string | null>(null);

  const status = store.snapshot.status;
  const liveSession = store.snapshot.session;
  const storeError = store.snapshot.error;
  const messages = store.snapshot.messages;

  const needsYou = useMemo(() => {
    if (remote?.waitingForInput) return true;
    try {
      return chatNeedsUserInput(events as readonly SessionStreamEvent[]);
    } catch {
      return false;
    }
  }, [events, remote?.waitingForInput]);

  const subagentRuns = useMemo(
    () => deriveSubagentRuns(events, Date.now()),
    [events],
  );
  const runningCoder = subagentRuns.some(
    (run) =>
      run.state === "running" &&
      (run.name === "coder" || run.name.toLowerCase().includes("coder")),
  );
  const recentRuns = subagentRuns.slice(-6).reverse();

  const writingInFlight = useMemo(() => {
    for (const message of messages) {
      for (const part of message.parts) {
        if (part.type !== "tool") continue;
        if (part.name !== "write_file" && part.name !== "edit_file") continue;
        if (part.state === "streaming" || part.state === "running") {
          return true;
        }
      }
    }
    return tabs.some((tab) => tab.kind === "file" && tab.running);
  }, [messages, tabs]);

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
  const writingActive =
    status === "busy" || writingInFlight || fileTabs.some((t) => t.running);
  const sessionId =
    liveSession?.sessionId ?? remote?.session?.sessionId ?? null;
  const streamIndex =
    liveSession?.streamIndex ?? remote?.session?.streamIndex ?? null;

  const files = remote?.files ?? [];

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

  const openWorkspaceDetail = useCallback(() => {
    setMode("workspace");
  }, []);

  const openFileRow = useCallback(
    async (file: AgentFileMeta) => {
      setOpeningPath(file.path);
      try {
        await openPath(file.path);
        setMode("workspace");
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
    status === "idle" &&
    !needsYou &&
    !browserActive &&
    !writingActive &&
    !runningCoder &&
    files.length === 0 &&
    tabs.length === 0 &&
    recentRuns.length === 0;

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
            Pearl’s computer for this chat — session state, sandboxes, browsers,
            and edited files show up here as the agent works.
          </Text>
        ) : null}

        <Section title="Session">
          <Row
            label="Status"
            value={
              needsYou
                ? "Needs you"
                : status === "busy"
                  ? "Busy"
                  : status === "resuming"
                    ? "Resuming"
                    : "Idle"
            }
          />
          <Row
            label="Session"
            value={sessionId ? truncateId(sessionId) : "None yet"}
          />
          <Row
            label="Stream"
            value={streamIndex !== null ? String(streamIndex) : "—"}
          />
          {controlMode && browserActive ? (
            <Row
              label="Browser control"
              value={controlMode === "user" ? "You" : "Agent"}
            />
          ) : null}
          {storeError ? (
            <Text className="text-destructive mt-2 text-xs" selectable>
              {storeError.message}
            </Text>
          ) : null}
        </Section>

        <Section title="Environments">
          <EnvRow
            icon={GlobeIcon}
            name="Browser"
            active={browserActive}
            detail={
              browserActive
                ? pageTabs.length > 0
                  ? `${pageTabs.length} tab${pageTabs.length === 1 ? "" : "s"}`
                  : "Sandbox active"
                : "Not open"
            }
          />
          <EnvRow
            icon={FileTextIcon}
            name="Writing"
            active={writingActive}
            detail={
              writingActive
                ? writingInFlight
                  ? "Editing files"
                  : status === "busy"
                    ? "Session busy"
                    : "Open"
                : "Idle"
            }
          />
          <EnvRow
            icon={TerminalIcon}
            name="Coder"
            active={runningCoder}
            detail={runningCoder ? "Subagent running" : "Idle"}
          />
        </Section>

        <Section title="App previews">
          {(remote?.previews?.length ?? 0) === 0 ? (
            <Text className="text-muted-foreground text-sm">
              No live sandbox or Expo simulator preview yet.
            </Text>
          ) : (
            (remote?.previews ?? []).map((preview) => (
              <Pressable
                key={`${preview.kind}:${preview.url}`}
                accessibilityRole="button"
                className="border-border/50 mb-2 rounded-xl border px-3 py-3"
                onPress={() => {
                  openWebUrl(preview.url);
                }}
              >
                <Text className="text-foreground text-sm font-medium">
                  {preview.label}
                </Text>
                <Text
                  numberOfLines={1}
                  className="text-muted-foreground mt-1 text-xs"
                >
                  {preview.url}
                </Text>
              </Pressable>
            ))
          )}
        </Section>

        <Section title="Browsers">
          {pageTabs.length === 0 ? (
            <Text className="text-muted-foreground text-sm">
              No open browser tabs.
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
          {pageTabs.length > 0 || fileTabs.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              className="mt-1 min-h-10 justify-center"
              onPress={openWorkspaceDetail}
            >
              <Text className="text-foreground text-sm font-medium">
                Open workspace preview
              </Text>
            </Pressable>
          ) : null}
        </Section>

        <Section title="Edited files">
          {fileTabs.length > 0 ? (
            <>
              <Text className="text-muted-foreground mb-2 text-xs uppercase tracking-wide">
                Open now
              </Text>
              {fileTabs.map((tab) => (
                <Pressable
                  key={tab.id}
                  accessibilityRole="button"
                  className="border-border/50 mb-2 rounded-xl border px-3 py-3"
                  onPress={() => {
                    selectWorkspaceTab(tab.id);
                    setMode("workspace");
                  }}
                >
                  <View className="flex-row items-center gap-2">
                    <Icon
                      as={FileTextIcon}
                      className="text-muted-foreground size-4"
                    />
                    <Text
                      numberOfLines={1}
                      className="text-foreground flex-1 text-sm font-medium"
                    >
                      {basename(tab.path)}
                    </Text>
                    {tab.running ? (
                      <Text className="text-amber-500 text-xs">Running</Text>
                    ) : null}
                  </View>
                  <Text
                    numberOfLines={1}
                    className="text-muted-foreground mt-1 text-xs"
                  >
                    {tab.path}
                  </Text>
                </Pressable>
              ))}
            </>
          ) : null}

          {files.length === 0 ? (
            fileTabs.length === 0 ? (
              <Text className="text-muted-foreground text-sm">
                No saved files yet.
              </Text>
            ) : null
          ) : (
            <>
              {fileTabs.length > 0 ? (
                <Text className="text-muted-foreground mb-2 mt-3 text-xs uppercase tracking-wide">
                  Saved
                </Text>
              ) : null}
              {files.map((file) => {
                const opening = openingPath === file.path;
                return (
                  <Pressable
                    key={file.id}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: opening }}
                    disabled={opening}
                    className="border-border/50 mb-2 rounded-xl border px-3 py-3"
                    onPress={() => void openFileRow(file)}
                  >
                    <View className="flex-row items-center gap-2">
                      <Icon
                        as={FileTextIcon}
                        className="text-muted-foreground size-4"
                      />
                      <Text
                        numberOfLines={1}
                        className="text-foreground flex-1 text-sm font-medium"
                      >
                        {basename(file.path)}
                      </Text>
                      {opening ? (
                        <ActivityIndicator size="small" />
                      ) : (
                        <Text className="text-muted-foreground text-xs">
                          v{file.version} · {formatBytes(file.byteLength)}
                        </Text>
                      )}
                    </View>
                    <Text
                      numberOfLines={1}
                      className="text-muted-foreground mt-1 text-xs"
                    >
                      {file.path}
                    </Text>
                  </Pressable>
                );
              })}
            </>
          )}
        </Section>

        <Section title="Delegated work">
          {recentRuns.length === 0 ? (
            <Text className="text-muted-foreground text-sm">
              No subagent runs in this session.
            </Text>
          ) : (
            recentRuns.map((run) => (
              <View
                key={run.callId}
                className="border-border/50 mb-2 rounded-xl border px-3 py-3"
              >
                <View className="flex-row items-center gap-2">
                  <Icon
                    as={TerminalIcon}
                    className="text-muted-foreground size-4"
                  />
                  <Text className="text-foreground flex-1 text-sm font-medium">
                    {run.name}
                  </Text>
                  <Text
                    className={
                      run.state === "running"
                        ? "text-amber-500 text-xs"
                        : run.state === "failed"
                          ? "text-destructive text-xs"
                          : "text-muted-foreground text-xs"
                    }
                  >
                    {run.state === "running"
                      ? "Running"
                      : run.state === "failed"
                        ? "Failed"
                        : "Ready"}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Section>
      </ScrollView>
    </View>
  );
}

function truncateId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
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

function Row({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <View className="mb-2 flex-row items-baseline justify-between gap-3">
      <Text className="text-muted-foreground text-sm">{label}</Text>
      <Text
        selectable
        className="text-foreground max-w-[65%] text-right text-sm font-medium"
      >
        {value}
      </Text>
    </View>
  );
}

function EnvRow({
  icon,
  name,
  active,
  detail,
}: {
  readonly icon: typeof GlobeIcon;
  readonly name: string;
  readonly active: boolean;
  readonly detail: string;
}) {
  return (
    <View className="border-border/50 mb-2 flex-row items-center gap-3 rounded-xl border px-3 py-3">
      <Icon as={icon} className="text-muted-foreground size-4" />
      <View className="min-w-0 flex-1">
        <Text className="text-foreground text-sm font-medium">{name}</Text>
        <Text className="text-muted-foreground text-xs">{detail}</Text>
      </View>
      <View
        className={
          active
            ? "bg-emerald-500/20 size-2 rounded-full"
            : "bg-muted-foreground/30 size-2 rounded-full"
        }
      />
    </View>
  );
}
