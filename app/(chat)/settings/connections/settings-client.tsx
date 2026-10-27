"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConnectionId, ConnectionStatus } from "@/lib/connections/catalog";

const LABELS: Record<ConnectionStatus["status"], string> = {
  unavailable: "Unavailable",
  available: "Available · not checked",
  unknown: "Unable to verify",
  connected: "Connected",
  "not-connected": "Not connected",
};

export function ConnectionsSettings() {
  const [connections, setConnections] = useState<ConnectionStatus[] | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<ConnectionId | null>(null);
  const [connecting, setConnecting] = useState<ConnectionId | null>(null);
  const [disconnecting, setDisconnecting] = useState<ConnectionId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy =
    loading || checking !== null || connecting !== null || disconnecting !== null;

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/connections/status", {
        cache: "no-store",
        signal,
      });
      if (!response.ok) {
        throw new Error(`Could not load connections (${response.status}).`);
      }
      const data = (await response.json()) as {
        connections: ConnectionStatus[];
      };
      if (!signal?.aborted) setConnections(data.connections);
    } catch (cause) {
      if (!signal?.aborted) {
        setError(
          cause instanceof Error ? cause.message : "Could not load connections.",
        );
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const check = async (id: ConnectionId) => {
    if (busy) return;
    setChecking(id);
    setError(null);
    try {
      const response = await fetch("/api/connections/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        throw new Error(`Could not check connection (${response.status}).`);
      }
      const data = (await response.json()) as { connection: ConnectionStatus };
      setConnections(
        (current) =>
          current?.map((item) => (item.id === id ? data.connection : item)) ?? [
            data.connection,
          ],
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not check connection.",
      );
    } finally {
      setChecking(null);
    }
  };

  const connect = async (id: ConnectionId) => {
    if (busy) return;
    setConnecting(id);
    setError(null);
    try {
      const response = await fetch("/api/connections/authorize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        throw new Error(`Could not start authorization (${response.status}).`);
      }
      const data = (await response.json()) as { url: string };
      const url = new URL(data.url);
      if (url.protocol !== "https:" || url.username || url.password) {
        throw new Error("Unsafe authorization URL.");
      }
      window.location.assign(url.href);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not start authorization.",
      );
      setConnecting(null);
    }
  };

  const disconnect = async (id: ConnectionId) => {
    if (busy) return;
    setDisconnecting(id);
    setError(null);
    try {
      const response = await fetch("/api/connections/revoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        throw new Error(`Could not disconnect (${response.status}).`);
      }
      const data = (await response.json()) as { connection: ConnectionStatus };
      setConnections(
        (current) =>
          current?.map((item) => (item.id === id ? data.connection : item)) ?? [
            data.connection,
          ],
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not disconnect.",
      );
    } finally {
      setDisconnecting(null);
    }
  };

  return (
    <section className="flex flex-col gap-4" aria-label="Connection status">
      <p className="text-sm text-muted-foreground">
        Available means the connector is attached to this app; it does not mean
        you have authorized it. Your authorization is stored by Vercel Connect,
        not in this browser. Checking status may refresh a token but never
        grants access.
      </p>
      <button
        type="button"
        className="min-h-11 self-start rounded-lg border px-3 text-sm hover:bg-muted disabled:opacity-50"
        disabled={busy}
        onClick={() => void load()}
      >
        {loading ? "Loading…" : "Refresh list"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {loading && !connections ? (
        <p className="text-sm text-muted-foreground">Checking availability…</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {connections?.map((item) => (
          <article
            className="flex flex-col gap-2 rounded-xl border bg-card p-4"
            key={item.id}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-medium">{item.label}</h2>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                {LABELS[item.status]}
              </span>
            </div>
            <p className="min-h-10 text-sm text-muted-foreground">
              {item.detail}
            </p>
            <div className="flex flex-wrap gap-2">
              {item.status === "not-connected" ||
              item.status === "available" ||
              item.status === "unknown" ? (
                <button
                  type="button"
                  disabled={busy}
                  className="min-h-11 rounded-lg bg-foreground px-4 text-sm text-background disabled:opacity-50"
                  onClick={() => void connect(item.id)}
                >
                  {connecting === item.id
                    ? "Connecting…"
                    : `Connect ${item.label}`}
                </button>
              ) : null}
              {item.status === "connected" || item.status === "unknown" ? (
                <button
                  type="button"
                  disabled={busy}
                  className="min-h-11 rounded-lg border px-4 text-sm text-destructive hover:bg-muted disabled:opacity-50"
                  onClick={() => void disconnect(item.id)}
                >
                  {disconnecting === item.id
                    ? "Disconnecting…"
                    : "Disconnect"}
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy || item.status === "unavailable"}
                className="min-h-11 rounded-lg border px-3 text-sm hover:bg-muted disabled:opacity-50"
                onClick={() => void check(item.id)}
              >
                {checking === item.id ? "Checking…" : "Check my status"}
              </button>
            </div>
          </article>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        If a connection needs authorization, Pearl will also show a sign-in
        challenge when you use it in chat.
      </p>
    </section>
  );
}
