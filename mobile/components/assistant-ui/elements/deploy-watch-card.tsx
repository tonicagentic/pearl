import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { ExternalLink, ListTree } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import {
  fetchWatchSnapshot,
  isTerminalWatchState,
  WATCH_POLL_MS,
} from "@/lib/watch/client";
import type { WatchSnapshot, WatchState } from "@/lib/watch/deploy";
import { AGENT_URL, getAuthCookie } from "@/src/eve-transport";

function statusLabel(state: WatchState): string {
  switch (state) {
    case "ready":
      return "Ready";
    case "error":
      return "Error";
    case "canceled":
      return "Canceled";
    case "queued":
      return "Queued";
    case "building":
      return "Building";
    default:
      return "Starting";
  }
}

function statusBarClass(state: WatchState): string {
  switch (state) {
    case "ready":
      return "bg-emerald-500/10";
    case "error":
      return "bg-red-500/10";
    case "canceled":
      return "bg-foreground/5";
    case "queued":
      return "bg-amber-500/10";
    case "building":
      return "bg-sky-500/10";
    default:
      return "bg-foreground/5";
  }
}

function statusDotClass(state: WatchState): string {
  switch (state) {
    case "ready":
      return "bg-emerald-500";
    case "error":
      return "bg-red-500";
    case "canceled":
      return "bg-foreground/35";
    case "building":
      return "bg-sky-500";
    default:
      return "bg-amber-500";
  }
}

function hostLabel(url: string | null | undefined): string {
  if (!url) return "—";
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).host;
  } catch {
    return url;
  }
}

async function openUrl(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    // ignore
  }
}

export function DeployWatchCard({
  handle,
}: {
  readonly handle: WatchSnapshot;
}) {
  const [snap, setSnap] = useState(handle);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<readonly string[]>(handle.logs ?? []);

  useEffect(() => {
    setSnap(handle);
    setLogs(handle.logs ?? []);
  }, [handle]);

  useEffect(() => {
    if (isTerminalWatchState(snap.state) && logs.length > 0) return;

    let cancelled = false;
    const poll = async (withLogs: boolean) => {
      try {
        const next = await fetchWatchSnapshot({
          baseUrl: AGENT_URL,
          handle: snap.deploymentId || snap.buildId || snap.url ? snap : handle,
          bearer: getAuthCookie(),
          includeLogs: withLogs,
        });
        if (cancelled) return;
        setSnap(next);
        if (next.logs?.length) setLogs(next.logs);
      } catch {
        // Keep last good snapshot.
      }
    };

    void poll(logsOpen || isTerminalWatchState(snap.state));
    if (isTerminalWatchState(snap.state)) return;

    const timer = setInterval(() => {
      void poll(logsOpen);
    }, WATCH_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional identity keys
  }, [
    handle.deploymentId,
    handle.buildId,
    handle.url,
    handle.provider,
    logsOpen,
    snap.state,
  ]);

  const visitUrl = snap.url
    ? snap.url.startsWith("http")
      ? snap.url
      : `https://${snap.url}`
    : null;
  const dashboard =
    snap.dashboardUrl ??
    (snap.provider === "vercel" ? "https://vercel.com" : "https://expo.dev");
  const providerLabel = snap.provider === "vercel" ? "Vercel" : "Expo";

  return (
    <View
      className="border-border/70 overflow-hidden rounded-xl border bg-background"
      testID={`deploy-watch-${snap.provider}`}
    >
      <View className="flex-row items-start justify-between gap-3 px-3.5 py-3">
        <View className="min-w-0 flex-1">
          <Text variant="body" className="font-medium leading-snug">
            {snap.title}
          </Text>
          {visitUrl ? (
            <Pressable onPress={() => void openUrl(visitUrl)}>
              <Text variant="caption" className="mt-0.5 text-sky-600">
                {hostLabel(visitUrl)}
              </Text>
            </Pressable>
          ) : (
            <Text variant="caption" className="text-foreground/45 mt-0.5">
              Waiting for URL…
            </Text>
          )}
        </View>
        {visitUrl ? (
          <Pressable
            onPress={() => void openUrl(visitUrl)}
            className="bg-foreground flex-row items-center gap-1.5 rounded-md px-2.5 py-1.5"
          >
            <Text variant="caption" className="text-background font-medium">
              Visit
            </Text>
            <ExternalLink size={14} className="text-background" />
          </Pressable>
        ) : null}
      </View>

      <View
        className={cn(
          "flex-row items-center justify-between gap-2 px-3.5 py-2",
          statusBarClass(snap.state),
        )}
      >
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          <View
            className={cn("size-2 rounded-full", statusDotClass(snap.state))}
          />
          <Text variant="caption" className="font-medium">
            {statusLabel(snap.state)}
          </Text>
          {snap.error ? (
            <Text
              variant="caption"
              className="text-foreground/55 flex-1"
              numberOfLines={1}
            >
              · {snap.error}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => setLogsOpen((open) => !open)}
          className="flex-row items-center gap-1 opacity-80"
        >
          <ListTree size={14} className="text-foreground" />
          <Text variant="caption">Logs</Text>
        </Pressable>
      </View>

      {logsOpen ? (
        <ScrollView
          className="border-border/60 max-h-40 border-t bg-foreground/5 px-3.5 py-2"
          nestedScrollEnabled
        >
          <Text variant="caption" className="font-mono leading-relaxed">
            {logs.length > 0
              ? logs.join("\n")
              : isTerminalWatchState(snap.state)
                ? "No log lines yet."
                : "Fetching logs…"}
          </Text>
        </ScrollView>
      ) : null}

      <View className="border-border/60 flex-row items-center justify-between gap-2 border-t bg-foreground/5 px-3.5 py-2">
        <Text variant="caption" className="text-foreground/55">
          Source
        </Text>
        <Pressable
          onPress={() => void openUrl(dashboard)}
          className="flex-row items-center gap-1.5"
        >
          {snap.provider === "vercel" ? (
            <Text variant="caption">▲</Text>
          ) : null}
          <Text variant="caption">Open in {providerLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function DeployWatchStack({
  handles,
}: {
  readonly handles: readonly WatchSnapshot[];
}) {
  if (handles.length === 0) return null;
  return (
    <View className="flex-col gap-2">
      {handles.map((handle) => (
        <DeployWatchCard
          key={`${handle.provider}:${handle.deploymentId ?? handle.buildId ?? handle.url ?? handle.title}`}
          handle={handle}
        />
      ))}
    </View>
  );
}
