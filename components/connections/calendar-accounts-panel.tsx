"use client";

import { useCallback, useEffect, useState } from "react";

import { GrantDetails } from "@/components/connections/grant-panel";
import type { IcloudCalendarAccountSummary } from "@/lib/calendar/types";
import type { ConnectionGrantSummary } from "@/lib/connections/grant-types";
import {
  capabilitiesForConnection,
  capabilitiesForPlugin,
  type PluginCapabilities,
} from "@/lib/plugins/capabilities";

/**
 * Combined Google Calendar (Connect) + iCloud Calendar (CalDAV credentials)
 * panel for Plugins → Calendar / iCloud Calendar.
 */
export function CalendarAccountsPanel() {
  return (
    <div className="flex flex-col gap-4">
      <GoogleCalendarBlock />
      <IcloudCalendarBlock />
    </div>
  );
}

function GoogleCalendarBlock() {
  const [grant, setGrant] = useState<ConnectionGrantSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = loading || connecting || disconnecting;
  const capabilities = capabilitiesForConnection("calendar");
  const connected = grant?.status === "connected";
  const state = grant?.status;

  const load = useCallback(async (signal?: AbortSignal) => {
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
        setGrant(data.grants.find((item) => item.id === "calendar") ?? null);
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
  }, []);

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
        body: JSON.stringify({ id: "calendar" }),
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
        body: JSON.stringify({ id: "calendar" }),
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
        <h2 className="font-medium">Google Calendar</h2>
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
          Pearl never stores Google tokens in this browser.
        </p>
      </div>
      {capabilities ? (
        <CapabilitiesCard
          capabilities={capabilities}
          heading={
            connected
              ? "What Pearl can do with Google Calendar"
              : "What Pearl can do after you connect Google Calendar"
          }
        />
      ) : null}
    </div>
  );
}

function IcloudCalendarBlock() {
  const [accounts, setAccounts] = useState<
    readonly IcloudCalendarAccountSummary[]
  >([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | "add" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appleId, setAppleId] = useState("");
  const [appSpecificPassword, setAppSpecificPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [showForm, setShowForm] = useState(false);
  const capabilities = capabilitiesForPlugin("icloud-calendar");
  const busy = loading || busyId !== null;
  const connectedCount = accounts.filter(
    (item) => item.status === "connected",
  ).length;

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/calendar-accounts", {
        cache: "no-store",
        signal,
      });
      if (!response.ok) {
        throw new Error(`Could not load accounts (${response.status}).`);
      }
      const data = (await response.json()) as {
        accounts: IcloudCalendarAccountSummary[];
        available: boolean;
      };
      if (!signal?.aborted) {
        setAccounts(data.accounts);
        setAvailable(data.available);
      }
    } catch (cause) {
      if (!signal?.aborted) {
        setError(
          cause instanceof Error ? cause.message : "Could not load accounts.",
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

  const connect = async () => {
    if (busy) return;
    setBusyId("add");
    setError(null);
    try {
      const response = await fetch("/api/calendar-accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          appleId,
          appSpecificPassword,
          ...(nickname.trim() ? { nickname: nickname.trim() } : {}),
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        accounts?: IcloudCalendarAccountSummary[];
      } | null;
      if (!response.ok) {
        throw new Error(
          data?.error?.trim() ||
            `Could not link iCloud Calendar (${response.status}).`,
        );
      }
      setAccounts(data?.accounts ?? []);
      setAppleId("");
      setAppSpecificPassword("");
      setNickname("");
      setShowForm(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not link iCloud Calendar.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const disconnect = async (accountId: string) => {
    if (busy) return;
    setBusyId(accountId);
    setError(null);
    try {
      const response = await fetch("/api/calendar-accounts/revoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      if (!response.ok) {
        throw new Error(`Could not disconnect (${response.status}).`);
      }
      const data = (await response.json()) as {
        accounts: IcloudCalendarAccountSummary[];
      };
      setAccounts(data.accounts);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not disconnect.",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">iCloud Calendar</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {!available
                ? "Unavailable on this deployment"
                : connectedCount === 0
                  ? "None connected"
                  : `${connectedCount} connected`}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            className="min-h-11 shrink-0 rounded-lg border px-3 text-sm hover:bg-muted disabled:opacity-50"
            onClick={() => void load()}
          >
            {loading ? "Checking…" : "Refresh"}
          </button>
        </div>

        {loading && accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading accounts…</p>
        ) : null}

        {accounts.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="rounded-xl border bg-background p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {account.nickname?.trim()
                        ? `${account.nickname.trim()} · ${account.appleId}`
                        : account.appleId}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {account.status === "connected"
                        ? "Connected"
                        : account.status === "unavailable"
                          ? "Unavailable"
                          : "Unable to verify"}
                      {account.detail ? ` · ${account.detail}` : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    className="min-h-10 rounded-lg border px-3 text-sm text-destructive hover:bg-muted disabled:opacity-50"
                    onClick={() => void disconnect(account.id)}
                  >
                    {busyId === account.id ? "…" : "Disconnect"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {showForm ? (
          <form
            className="flex flex-col gap-3 rounded-xl border bg-background p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void connect();
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Apple ID</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={appleId}
                onChange={(event) => setAppleId(event.target.value)}
                className="min-h-11 rounded-lg border bg-card px-3"
                placeholder="you@icloud.com"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">App-specific password</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={appSpecificPassword}
                onChange={(event) => setAppSpecificPassword(event.target.value)}
                className="min-h-11 rounded-lg border bg-card px-3"
                placeholder="xxxx-xxxx-xxxx-xxxx"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Nickname (optional)</span>
              <input
                type="text"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                className="min-h-11 rounded-lg border bg-card px-3"
                placeholder="Personal"
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Create an app-specific password at{" "}
              <a
                href="https://appleid.apple.com/account/manage"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                appleid.apple.com
              </a>
              . Pearl encrypts it at rest and never shows it again.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy || !available}
                className="min-h-11 rounded-lg bg-foreground px-4 text-sm text-background disabled:opacity-50"
              >
                {busyId === "add" ? "Connecting…" : "Connect iCloud"}
              </button>
              <button
                type="button"
                disabled={busy}
                className="min-h-11 rounded-lg border px-4 text-sm hover:bg-muted disabled:opacity-50"
                onClick={() => {
                  setShowForm(false);
                  setAppSpecificPassword("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            disabled={busy || !available}
            className="min-h-11 self-start rounded-lg bg-foreground px-4 text-sm text-background disabled:opacity-50"
            onClick={() => setShowForm(true)}
          >
            Add iCloud Calendar
          </button>
        )}
      </div>

      {capabilities ? (
        <CapabilitiesCard
          capabilities={capabilities}
          heading={
            connectedCount > 0
              ? "What Pearl can do with iCloud Calendar"
              : "What Pearl can do after you connect iCloud Calendar"
          }
        />
      ) : null}
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
