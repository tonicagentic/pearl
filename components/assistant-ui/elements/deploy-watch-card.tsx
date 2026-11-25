"use client";

import { useEffect, useState } from "react";
import { ExternalLink, ListTree } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  fetchWatchSnapshot,
  isTerminalWatchState,
  WATCH_POLL_MS,
} from "@/lib/watch/client";
import type { WatchSnapshot, WatchState } from "@/lib/watch/deploy";

function statusStyles(state: WatchState): {
  readonly bar: string;
  readonly label: string;
} {
  switch (state) {
    case "ready":
      return {
        bar: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        label: "Ready",
      };
    case "error":
      return {
        bar: "bg-red-500/10 text-red-700 dark:text-red-400",
        label: "Error",
      };
    case "canceled":
      return {
        bar: "bg-foreground/5 text-foreground/55",
        label: "Canceled",
      };
    case "queued":
      return {
        bar: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
        label: "Queued",
      };
    case "building":
      return {
        bar: "bg-sky-500/10 text-sky-800 dark:text-sky-300",
        label: "Building",
      };
    default:
      return {
        bar: "bg-foreground/5 text-foreground/60",
        label: "Starting",
      };
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

function StatusDot({ state }: { readonly state: WatchState }) {
  const color =
    state === "ready"
      ? "bg-emerald-500"
      : state === "error"
        ? "bg-red-500"
        : state === "canceled"
          ? "bg-foreground/35"
          : state === "building"
            ? "bg-sky-500"
            : "bg-amber-500";
  return (
    <span
      aria-hidden
      className={cn("size-2 shrink-0 rounded-full", color)}
    />
  );
}

/**
 * Live Vercel / EAS watch card. Polls `/api/watch/*` until terminal.
 */
export function DeployWatchCard({
  handle,
  baseUrl = typeof window !== "undefined" ? window.location.origin : "",
  bearer,
}: {
  readonly handle: WatchSnapshot;
  readonly baseUrl?: string;
  readonly bearer?: string | null;
}) {
  const [snap, setSnap] = useState(handle);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<readonly string[]>(handle.logs ?? []);

  useEffect(() => {
    setSnap(handle);
    setLogs(handle.logs ?? []);
  }, [handle]);

  useEffect(() => {
    if (!baseUrl) return;
    if (isTerminalWatchState(snap.state) && logs.length > 0) return;

    let cancelled = false;
    const poll = async (withLogs: boolean) => {
      try {
        const next = await fetchWatchSnapshot({
          baseUrl,
          handle: snap.deploymentId || snap.buildId || snap.url ? snap : handle,
          bearer,
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

    const timer = window.setInterval(() => {
      void poll(logsOpen);
    }, WATCH_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // Re-key on identity + open logs, not every snap field.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [
    baseUrl,
    bearer,
    handle.deploymentId,
    handle.buildId,
    handle.url,
    handle.provider,
    logsOpen,
    snap.state,
  ]);

  const styles = statusStyles(snap.state);
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
    <div
      data-slot="deploy-watch-card"
      data-provider={snap.provider}
      data-state={snap.state}
      className="border-border/70 overflow-hidden rounded-xl border bg-background text-sm"
    >
      <div className="flex items-start justify-between gap-3 px-3.5 py-3">
        <div className="min-w-0">
          <div className="text-foreground font-medium leading-snug">
            {snap.title}
          </div>
          {visitUrl ? (
            <a
              href={visitUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-600 dark:text-sky-400 mt-0.5 block truncate hover:underline"
            >
              {hostLabel(visitUrl)}
            </a>
          ) : (
            <div className="text-foreground/45 mt-0.5 truncate">
              Waiting for URL…
            </div>
          )}
        </div>
        {visitUrl ? (
          <a
            href={visitUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-foreground text-background inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium"
          >
            Visit
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : null}
      </div>

      <div
        className={cn(
          "flex items-center justify-between gap-2 px-3.5 py-2",
          styles.bar,
        )}
      >
        <div className="flex items-center gap-2 font-medium">
          <StatusDot state={snap.state} />
          {styles.label}
          {snap.error ? (
            <span className="text-foreground/55 max-w-[14rem] truncate font-normal">
              · {snap.error}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            className="inline-flex items-center gap-1 opacity-80 hover:opacity-100"
            onClick={() => setLogsOpen((open) => !open)}
          >
            <ListTree className="size-3.5" aria-hidden />
            Logs
          </button>
        </div>
      </div>

      {logsOpen ? (
        <pre className="text-foreground/70 max-h-40 overflow-auto border-t border-border/60 bg-foreground/[0.02] px-3.5 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
          {logs.length > 0
            ? logs.join("\n")
            : isTerminalWatchState(snap.state)
              ? "No log lines yet."
              : "Fetching logs…"}
        </pre>
      ) : null}

      <div className="text-foreground/55 flex items-center justify-between gap-2 border-t border-border/60 bg-foreground/[0.02] px-3.5 py-2 text-xs">
        <span>Source</span>
        <a
          href={dashboard}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground inline-flex items-center gap-1.5 hover:underline"
        >
          {snap.provider === "vercel" ? (
            <span aria-hidden className="text-[10px] leading-none">
              ▲
            </span>
          ) : null}
          Open in {providerLabel}
        </a>
      </div>
    </div>
  );
}

/** Stack one or more watch cards for a coder row. */
export function DeployWatchStack({
  handles,
  baseUrl,
  bearer,
}: {
  readonly handles: readonly WatchSnapshot[];
  readonly baseUrl?: string;
  readonly bearer?: string | null;
}) {
  if (handles.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {handles.map((handle) => (
        <DeployWatchCard
          key={`${handle.provider}:${handle.deploymentId ?? handle.buildId ?? handle.url ?? handle.title}`}
          handle={handle}
          baseUrl={baseUrl}
          bearer={bearer}
        />
      ))}
    </div>
  );
}
