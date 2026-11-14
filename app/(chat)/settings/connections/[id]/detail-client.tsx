"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarAccountsPanel } from "@/components/connections/calendar-accounts-panel";
import { GmailMailboxesPanel } from "@/components/connections/gmail-mailboxes-panel";
import { PluginLogo } from "@/components/connections/plugin-logo";
import { GrantDetails } from "@/components/connections/grant-panel";
import type { ConnectionId } from "@/lib/connections/catalog";
import type { ConnectionGrantSummary } from "@/lib/connections/grant-types";
import {
  capabilitiesForConnection,
  capabilitiesForPlugin,
  type PluginCapabilities,
} from "@/lib/plugins/capabilities";
import {
  isConnectablePlugin,
  isCredentialPlugin,
  type ResolvedPlugin,
} from "@/lib/plugins/catalog";

export function PluginDetailClient({
  plugin,
}: {
  readonly plugin: ResolvedPlugin;
}) {
  const builtinCapabilities =
    plugin.kind === "builtin" ? capabilitiesForPlugin(plugin.id) : null;
  const showCalendarPanel =
    (isConnectablePlugin(plugin) && plugin.connectionId === "calendar") ||
    (isCredentialPlugin(plugin) && plugin.id === "icloud-calendar");

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm">
        <Link
          href="/settings/connections"
          className="text-muted-foreground hover:text-foreground"
        >
          ← Plugins
        </Link>
      </p>

      <header className="flex items-start gap-4">
        <PluginLogo id={plugin.id} className="size-14 rounded-[14px]" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold">{plugin.label}</h1>
          <p className="text-sm text-muted-foreground">{plugin.detail}</p>
        </div>
      </header>

      <p className="max-w-2xl text-sm leading-relaxed text-foreground">
        {plugin.description}
      </p>

      {showCalendarPanel ? (
        <CalendarAccountsPanel />
      ) : isConnectablePlugin(plugin) ? (
        plugin.connectionId === "gmail" ? (
          <GmailMailboxesPanel />
        ) : (
          <ConnectionPanel connectionId={plugin.connectionId} />
        )
      ) : plugin.kind === "builtin" ? (
        <>
          <StatusCard
            title="Enabled"
            body="This capability ships with Pearl and does not need a separate account connection."
          />
          {builtinCapabilities ? (
            <CapabilitiesCard
              capabilities={builtinCapabilities}
              heading="What Pearl can do"
            />
          ) : null}
        </>
      ) : (
        <StatusCard
          title="Coming soon"
          body="This plugin is listed for the catalog preview. Connect will appear here when the connector ships."
        />
      )}
    </div>
  );
}

function CapabilitiesCard({
  capabilities,
  heading,
}: {
  readonly capabilities: PluginCapabilities;
  readonly heading: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <h2 className="font-medium">{heading}</h2>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
        {capabilities.canDo.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {capabilities.needsApproval.length > 0 ? (
        <>
          <h3 className="mt-4 text-sm font-medium text-foreground">
            Needs your approval
          </h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            {capabilities.needsApproval.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function StatusCard({
  title,
  body,
}: {
  readonly title: string;
  readonly body: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <h2 className="font-medium">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function ConnectionPanel({
  connectionId,
}: {
  readonly connectionId: ConnectionId;
}) {
  const [grant, setGrant] = useState<ConnectionGrantSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = loading || connecting || disconnecting;
  const capabilities = capabilitiesForConnection(connectionId);
  const connected = grant?.status === "connected";
  const state = grant?.status;

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/connections/grants", {
          cache: "no-store",
          signal,
        });
        if (!response.ok) {
          throw new Error(`Could not load grant (${response.status}).`);
        }
        const data = (await response.json()) as {
          grants: ConnectionGrantSummary[];
        };
        if (!signal?.aborted) {
          setGrant(
            data.grants.find((item) => item.id === connectionId) ?? null,
          );
        }
      } catch (cause) {
        if (!signal?.aborted) {
          setError(
            cause instanceof Error ? cause.message : "Could not load grant.",
          );
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [connectionId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const authorize = async () => {
    if (busy) return;
    setConnecting(true);
    setError(null);
    try {
      const response = await fetch("/api/connections/authorize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: connectionId }),
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
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (busy) return;
    setDisconnecting(true);
    setError(null);
    try {
      const response = await fetch("/api/connections/revoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: connectionId }),
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
      setDisconnecting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <h2 className="font-medium">Grant</h2>
        {loading && !grant ? (
          <p className="text-sm text-muted-foreground">Checking grant…</p>
        ) : null}
        {grant ? <GrantDetails grant={grant} /> : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {connected ? (
            <button
              type="button"
              disabled={busy}
              className="min-h-11 rounded-lg bg-foreground px-4 text-sm text-background disabled:opacity-50"
              onClick={() => void authorize()}
            >
              {connecting ? "Opening…" : "Update"}
            </button>
          ) : null}
          {state !== "connected" && state !== "unavailable" ? (
            <button
              type="button"
              disabled={busy}
              className="min-h-11 rounded-lg bg-foreground px-4 text-sm text-background disabled:opacity-50"
              onClick={() => void authorize()}
            >
              {connecting ? "Connecting…" : "Connect"}
            </button>
          ) : null}
          {state === "connected" || state === "unknown" ? (
            <button
              type="button"
              disabled={busy}
              className="min-h-11 rounded-lg border px-4 text-sm text-destructive hover:bg-muted disabled:opacity-50"
              onClick={() => void disconnect()}
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy || state === "unavailable"}
            className="min-h-11 rounded-lg border px-3 text-sm hover:bg-muted disabled:opacity-50"
            onClick={() => void load()}
          >
            {loading ? "Checking…" : "Refresh"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Authorization is stored by Vercel Connect for your signed-in account.
          Update reopens the provider consent screen without disconnecting
          first. Pearl never stores provider tokens in this browser.
        </p>
      </div>

      {capabilities ? (
        <CapabilitiesCard
          capabilities={capabilities}
          heading={
            connected
              ? "What Pearl can do"
              : "What Pearl can do after you connect"
          }
        />
      ) : null}
    </div>
  );
}
