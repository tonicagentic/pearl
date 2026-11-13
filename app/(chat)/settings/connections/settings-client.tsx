"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { PluginLogo } from "@/components/connections/plugin-logo";
import type { ConnectionStatus } from "@/lib/connections/catalog";
import {
  PLUGIN_SECTIONS,
  isConnectablePlugin,
  pluginsForSection,
  type PluginCatalogEntry,
  type PluginMarkId,
  type ResolvedPlugin,
} from "@/lib/plugins/catalog";

export function ConnectionsSettings() {
  const [connections, setConnections] = useState<ConnectionStatus[] | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const statusById = new Map(
    (connections ?? []).map((item) => [item.id, item] as const),
  );

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/connections/status", {
        cache: "no-store",
        signal,
      });
      if (!response.ok) {
        throw new Error(`Could not load plugins (${response.status}).`);
      }
      const data = (await response.json()) as {
        connections: ConnectionStatus[];
      };
      if (!signal?.aborted) setConnections(data.connections);
    } catch (cause) {
      if (!signal?.aborted) {
        setError(
          cause instanceof Error ? cause.message : "Could not load plugins.",
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

  return (
    <section className="flex flex-col gap-8" aria-label="Plugin catalog">
      <p className="text-sm text-muted-foreground">
        Connect accounts Pearl can use, and see built-in tools from Pearl and
        Tonic Agentic. Open a plugin for details and connection actions.
      </p>

      <button
        type="button"
        className="min-h-11 self-start rounded-lg border px-3 text-sm hover:bg-muted disabled:opacity-50"
        disabled={loading}
        onClick={() => void load()}
      >
        {loading ? "Loading…" : "Refresh accounts"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {loading && !connections ? (
        <p className="text-sm text-muted-foreground">Checking availability…</p>
      ) : null}

      {PLUGIN_SECTIONS.map((section) => {
        const plugins = pluginsForSection(section);
        if (plugins.length === 0) return null;
        return (
          <PluginSection key={section.id} title={section.title}>
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
              {plugins.map((plugin) => (
                <CatalogLink
                  key={plugin.id}
                  plugin={plugin}
                  trailing={trailingForPlugin(plugin, statusById)}
                />
              ))}
            </ul>
          </PluginSection>
        );
      })}
    </section>
  );
}

function trailingForPlugin(
  plugin: ResolvedPlugin,
  statusById: Map<string, ConnectionStatus>,
): string {
  if (plugin.kind === "coming_soon") return "Coming soon";
  if (plugin.kind === "builtin") return "Enabled";
  if (!isConnectablePlugin(plugin)) return "…";
  return trailingForStatus(statusById.get(plugin.connectionId));
}

function trailingForStatus(status: ConnectionStatus | undefined): string {
  if (!status) return "…";
  if (status.status === "connected") {
    return status.accountLabel?.trim() || "Connected";
  }
  if (status.status === "unavailable") return "Unavailable";
  return "Connect";
}

function PluginSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}

function CatalogLink({
  plugin,
  trailing,
}: {
  readonly plugin: ResolvedPlugin | PluginCatalogEntry;
  readonly trailing: string;
}) {
  return (
    <li>
      <Link
        href={`/settings/connections/${plugin.id}`}
        className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50"
      >
        <PluginLogo id={plugin.id as PluginMarkId} />
        <div className="min-w-0 flex-1">
          <h3 className="font-medium leading-snug">{plugin.label}</h3>
          <p className="text-sm text-muted-foreground">{plugin.detail}</p>
        </div>
        <span className="text-sm text-muted-foreground">{trailing}</span>
        <span className="text-muted-foreground/50" aria-hidden>
          ›
        </span>
      </Link>
    </li>
  );
}
