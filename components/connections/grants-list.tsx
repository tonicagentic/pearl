"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { PluginLogo } from "@/components/connections/plugin-logo";
import { GrantDetails } from "@/components/connections/grant-panel";
import type { ConnectionId } from "@/lib/connections/catalog";
import type { ConnectionGrantSummary } from "@/lib/connections/grant-types";
import type { PluginMarkId } from "@/lib/plugins/catalog";

const PLUGIN_HREF: Partial<Record<ConnectionId, string>> = {
  gmail: "/settings/connections/gmail",
  calendar: "/settings/connections/calendar",
  drive: "/settings/connections/drive",
  github: "/settings/connections/github",
  vercel: "/settings/connections/vercel",
  tempo: "/settings/connections/tempo",
  sheets: "/settings/connections/sheets",
  xero: "/settings/connections/xero",
};

/**
 * Account grants for the signed-in user: status, scopes, and Update to
 * re-authorize without disconnecting first.
 */
export function GrantsList() {
  const [grants, setGrants] = useState<ConnectionGrantSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<ConnectionId | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/connections/grants", {
        cache: "no-store",
        signal,
      });
      if (!response.ok) {
        throw new Error(`Could not load grants (${response.status}).`);
      }
      const data = (await response.json()) as {
        grants: ConnectionGrantSummary[];
      };
      if (!signal?.aborted) setGrants(data.grants);
    } catch (cause) {
      if (!signal?.aborted) {
        setError(
          cause instanceof Error ? cause.message : "Could not load grants.",
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

  const authorize = async (id: ConnectionId) => {
    if (busyId) return;
    setBusyId(id);
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
      setBusyId(null);
    }
  };

  const disconnect = async (id: ConnectionId) => {
    if (busyId) return;
    setBusyId(id);
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
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not disconnect.",
      );
    } finally {
      setBusyId(null);
    }
  };

  // Skip connectors that are not configured on this deployment.
  const visible =
    grants?.filter((grant) => grant.status !== "unavailable") ?? null;

  return (
    <section className="flex flex-col gap-3" aria-label="Account grants">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">
            Your grants
          </h2>
          <p className="text-sm text-muted-foreground">
            Pearl acts as you with these accounts. Update refreshes scopes and
            org access without disconnecting first.
          </p>
        </div>
        <button
          type="button"
          className="min-h-11 rounded-lg border px-3 text-sm hover:bg-muted disabled:opacity-50"
          disabled={loading || busyId !== null}
          onClick={() => void load()}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading && !visible ? (
        <p className="text-sm text-muted-foreground">Loading grants…</p>
      ) : null}

      {visible && visible.length === 0 ? (
        <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
          No connectors are configured on this deployment yet.
        </p>
      ) : null}

      {visible && visible.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {visible.map((grant) => {
            const href = PLUGIN_HREF[grant.id];
            const busy = busyId === grant.id;
            const connected = grant.status === "connected";
            const canConnect =
              grant.status !== "connected" && grant.status !== "unavailable";
            return (
              <li
                key={grant.id}
                className="flex flex-col gap-3 rounded-2xl border bg-card p-4"
              >
                <div className="flex items-start gap-3">
                  <PluginLogo id={grant.id as PluginMarkId} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h3 className="font-medium">{grant.label}</h3>
                      {href ? (
                        <Link
                          href={href}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Details
                        </Link>
                      ) : null}
                    </div>
                    <div className="mt-2">
                      <GrantDetails grant={grant} />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {connected ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="min-h-11 rounded-lg bg-foreground px-4 text-sm text-background disabled:opacity-50"
                      onClick={() => void authorize(grant.id)}
                    >
                      {busy ? "Opening…" : "Update"}
                    </button>
                  ) : null}
                  {canConnect ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="min-h-11 rounded-lg bg-foreground px-4 text-sm text-background disabled:opacity-50"
                      onClick={() => void authorize(grant.id)}
                    >
                      {busy ? "Opening…" : "Connect"}
                    </button>
                  ) : null}
                  {connected || grant.status === "unknown" ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="min-h-11 rounded-lg border px-4 text-sm text-destructive hover:bg-muted disabled:opacity-50"
                      onClick={() => void disconnect(grant.id)}
                    >
                      {busy ? "Working…" : "Disconnect"}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
