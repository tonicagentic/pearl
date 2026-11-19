"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import type { ConnectedAgentSummary } from "@/lib/connected-agents/types";

/**
 * Settings panel to add, rename, and remove private eve agents Pearl can call.
 */
export function ConnectedAgentsPanel() {
  const [agents, setAgents] = useState<ConnectedAgentSummary[] | null>(null);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/connected-agents", {
        cache: "no-store",
        signal,
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `Could not load agents (${response.status}).`);
      }
      const data = (await response.json()) as {
        agents: ConnectedAgentSummary[];
        available: boolean;
      };
      if (!signal?.aborted) {
        setAgents(data.agents);
        setAvailable(data.available);
      }
    } catch (cause) {
      if (!signal?.aborted) {
        setError(
          cause instanceof Error ? cause.message : "Could not load agents.",
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
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/connected-agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label, url, token }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        agents?: ConnectedAgentSummary[];
      };
      if (!response.ok) {
        throw new Error(data.error ?? `Could not connect (${response.status}).`);
      }
      setAgents(data.agents ?? []);
      setLabel("");
      setUrl("");
      setToken("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not connect that agent.",
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (agentId: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/connected-agents/${encodeURIComponent(agentId)}`,
        { method: "DELETE" },
      );
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        agents?: ConnectedAgentSummary[];
      };
      if (!response.ok) {
        throw new Error(data.error ?? `Could not remove (${response.status}).`);
      }
      setAgents(data.agents ?? []);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not remove that agent.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-6" aria-label="Connected agents">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Link a private eve deployment. Pearl stays your client: pick the agent
          in the composer and Pearl calls it as a remote agent. The bearer is
          encrypted at rest and never shown again.
        </p>
        <p className="text-sm text-muted-foreground">
          On the private agent, accept that bearer on its eve channel and set{" "}
          <code className="text-xs">EVE_CALLBACK_TRUSTED_ORIGINS</code> to this
          Pearl origin.{" "}
          <Link href="/settings/connections" className="underline">
            Plugins
          </Link>{" "}
          are separate from this list.
        </p>
      </div>

      {!available ? (
        <p role="alert" className="text-sm text-destructive">
          Connected agents need USER_SECRETS_KEY (or
          ICLOUD_CALDAV_CREDENTIALS_KEY) on this deployment.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-medium">Add agent</h2>
        <label className="flex flex-col gap-1 text-sm">
          <span>Name</span>
          <input
            className="min-h-11 rounded-lg border bg-background px-3"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Finance agent"
            disabled={busy || !available}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Agent URL</span>
          <input
            className="min-h-11 rounded-lg border bg-background px-3"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://my-agent.vercel.app"
            disabled={busy || !available}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Bearer token</span>
          <input
            type="password"
            className="min-h-11 rounded-lg border bg-background px-3"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Token the private agent accepts"
            disabled={busy || !available}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <button
          type="button"
          className="min-h-11 self-start rounded-lg border px-3 text-sm hover:bg-muted disabled:opacity-50"
          disabled={busy || !available || !label.trim() || !url.trim() || !token.trim()}
          onClick={() => void connect()}
        >
          {busy ? "Connecting…" : "Connect"}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Your agents</h2>
          <button
            type="button"
            className="min-h-11 rounded-lg border px-3 text-sm hover:bg-muted disabled:opacity-50"
            disabled={loading || busy}
            onClick={() => void load()}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
        {loading && !agents ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : null}
        {agents && agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No connected agents yet.
          </p>
        ) : null}
        {agents && agents.length > 0 ? (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {agents.map((agent) => (
              <li
                key={agent.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{agent.label}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {agent.url}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-destructive min-h-11 shrink-0 rounded-lg border px-3 text-sm hover:bg-muted disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void remove(agent.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
