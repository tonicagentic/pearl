"use client";

import { useCallback, useEffect, useState } from "react";

import type { MailboxClientSummary } from "@/lib/mail/types";
import {
  capabilitiesForConnection,
  type PluginCapabilities,
} from "@/lib/plugins/capabilities";

function displayName(mailbox: MailboxClientSummary): string {
  if (mailbox.nickname?.trim()) {
    return mailbox.emailLabel
      ? `${mailbox.nickname.trim()} · ${mailbox.emailLabel}`
      : mailbox.nickname.trim();
  }
  return mailbox.emailLabel ?? "Gmail account";
}

function statusLabel(status: MailboxClientSummary["status"]): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "not-connected":
      return "Not connected";
    case "unavailable":
      return "Unavailable";
    default:
      return "Unable to verify";
  }
}

/**
 * Multi-mailbox Gmail panel for web Settings → Plugins → Gmail.
 * Add / reconnect / disconnect go through /api/mailboxes.
 */
export function GmailMailboxesPanel() {
  const [mailboxes, setMailboxes] = useState<readonly MailboxClientSummary[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | "add" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const capabilities = capabilitiesForConnection("gmail");
  const busy = loading || busyId !== null;
  const connectedCount = mailboxes.filter(
    (item) => item.status === "connected",
  ).length;

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/mailboxes", {
        cache: "no-store",
        signal,
      });
      if (!response.ok) {
        throw new Error(`Could not load mailboxes (${response.status}).`);
      }
      const data = (await response.json()) as {
        mailboxes: MailboxClientSummary[];
      };
      if (!signal?.aborted) setMailboxes(data.mailboxes);
    } catch (cause) {
      if (!signal?.aborted) {
        setError(
          cause instanceof Error ? cause.message : "Could not load mailboxes.",
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

  const authorize = async (mailboxId?: string) => {
    if (busy) return;
    setBusyId(mailboxId ?? "add");
    setError(null);
    try {
      const response = await fetch("/api/mailboxes/authorize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mailboxId ? { mailboxId } : {}),
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

  const disconnect = async (mailboxId: string) => {
    if (busy) return;
    setBusyId(mailboxId);
    setError(null);
    try {
      const response = await fetch("/api/mailboxes/revoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mailboxId }),
      });
      if (!response.ok) {
        throw new Error(`Could not disconnect (${response.status}).`);
      }
      const data = (await response.json()) as {
        mailboxes: MailboxClientSummary[];
      };
      setMailboxes(data.mailboxes);
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
            <h2 className="font-medium">Gmail accounts</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {connectedCount === 0
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

        {loading && mailboxes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading accounts…</p>
        ) : null}

        {mailboxes.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {mailboxes.map((mailbox) => (
              <li
                key={mailbox.id}
                className="rounded-xl border bg-background p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {displayName(mailbox)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {statusLabel(mailbox.status)}
                      {mailbox.status === "connected" && !mailbox.canModify
                        ? " · reconnect for archive and mark-read"
                        : null}
                    </p>
                    {mailbox.detail ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {mailbox.detail}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {mailbox.status === "connected" ? (
                      <button
                        type="button"
                        disabled={busy}
                        className="min-h-10 rounded-lg bg-foreground px-3 text-sm text-background disabled:opacity-50"
                        onClick={() => void authorize(mailbox.id)}
                      >
                        {busyId === mailbox.id ? "Opening…" : "Update"}
                      </button>
                    ) : mailbox.status !== "unavailable" ? (
                      <button
                        type="button"
                        disabled={busy}
                        className="min-h-10 rounded-lg bg-foreground px-3 text-sm text-background disabled:opacity-50"
                        onClick={() => void authorize(mailbox.id)}
                      >
                        {busyId === mailbox.id ? "Opening…" : "Connect"}
                      </button>
                    ) : null}
                    {mailbox.status === "connected" ||
                    mailbox.status === "unknown" ||
                    mailbox.status === "not-connected" ? (
                      <button
                        type="button"
                        disabled={busy}
                        className="min-h-10 rounded-lg border px-3 text-sm text-destructive hover:bg-muted disabled:opacity-50"
                        onClick={() => void disconnect(mailbox.id)}
                      >
                        {busyId === mailbox.id ? "…" : "Disconnect"}
                      </button>
                    ) : null}
                  </div>
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

        <button
          type="button"
          disabled={busy}
          className="min-h-11 self-start rounded-lg bg-foreground px-4 text-sm text-background disabled:opacity-50"
          onClick={() => void authorize()}
        >
          {busyId === "add" ? "Opening…" : "Add Gmail account"}
        </button>

        <p className="text-xs text-muted-foreground">
          Each address is authorized separately through Google. Pearl never
          stores provider tokens in this browser. Archive and mark-read need a
          one-time reconnect if an account was connected before those
          permissions were added.
        </p>
      </div>

      {capabilities ? (
        <CapabilitiesCard
          capabilities={capabilities}
          heading={
            connectedCount > 0
              ? "What Pearl can do"
              : "What Pearl can do after you connect"
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
