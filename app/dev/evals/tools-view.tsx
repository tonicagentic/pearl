"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import type {
  ToolsCatalogAgent,
  ToolsCatalogTool,
  ToolsCatalogToolKind,
} from "@/lib/dev/eval-tools-catalog-types";
import {
  ToolUiPreview,
  ToolUiSurfaceChip,
} from "./tool-ui-preview";

type ToolsResponse = { agents: ToolsCatalogAgent[] };

async function readApiError(res: Response): Promise<string> {
  const text = await res.text();
  if (text.trimStart().startsWith("<!DOCTYPE") || text.includes("<html")) {
    return `API ${res.status}: Next.js returned an HTML error page. Hard-refresh or restart pnpm dev.`;
  }
  try {
    const json = JSON.parse(text) as { error?: string };
    if (json.error) return json.error;
  } catch {
    // fall through
  }
  return text.slice(0, 280) || `Request failed (${res.status})`;
}

function kindLabel(kind: ToolsCatalogToolKind): string {
  if (kind === "authored") return "authored";
  if (kind === "builtin") return "builtin";
  if (kind === "connection") return "connection";
  return "subagent";
}

function kindTone(kind: ToolsCatalogToolKind): string {
  if (kind === "authored") return "bg-sky-500/10 text-sky-950 dark:text-sky-100";
  if (kind === "builtin") return "bg-muted/60 text-muted-foreground";
  if (kind === "connection") {
    return "bg-violet-500/10 text-violet-950 dark:text-violet-100";
  }
  return "bg-emerald-500/10 text-emerald-950 dark:text-emerald-100";
}

export function ToolsView({
  agentId,
  onAgentChange,
  selectedTool,
  onSelectTool,
}: {
  agentId: string;
  onAgentChange: (id: string) => void;
  selectedTool: string | null;
  onSelectTool: (id: string | null) => void;
}) {
  const [agents, setAgents] = useState<ToolsCatalogAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | ToolsCatalogToolKind | "uncovered">(
    "all",
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/dev/evals?tools=1", { cache: "no-store" });
        if (!res.ok) throw new Error(await readApiError(res));
        const data = (await res.json()) as ToolsResponse;
        if (cancelled) return;
        const next = data.agents ?? [];
        setAgents(next);
        if (!next.some((agent) => agent.id === agentId)) {
          onAgentChange(next[0]?.id ?? "pearl");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load tools");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeAgent = useMemo(
    () => agents.find((agent) => agent.id === agentId) ?? agents[0] ?? null,
    [agents, agentId],
  );

  const filteredTools = useMemo(() => {
    if (!activeAgent) return [];
    const q = query.trim().toLowerCase();
    return activeAgent.tools.filter((tool) => {
      if (kindFilter === "uncovered" && tool.evals.length > 0) return false;
      if (
        kindFilter !== "all" &&
        kindFilter !== "uncovered" &&
        tool.kind !== kindFilter
      ) {
        return false;
      }
      if (!q) return true;
      const hay =
        `${tool.name} ${tool.origin} ${tool.description} ${tool.connectionId ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [activeAgent, query, kindFilter]);

  const selected = useMemo(() => {
    if (!activeAgent || !selectedTool) return null;
    return (
      activeAgent.tools.find(
        (tool) => toolKey(tool) === selectedTool || tool.name === selectedTool,
      ) ?? null
    );
  }, [activeAgent, selectedTool]);

  useEffect(() => {
    if (!activeAgent) return;
    if (
      selectedTool &&
      activeAgent.tools.some(
        (tool) => toolKey(tool) === selectedTool || tool.name === selectedTool,
      )
    ) {
      return;
    }
    const first = filteredTools[0] ?? activeAgent.tools[0];
    onSelectTool(first ? toolKey(first) : null);
    // Only re-pick when agent or filter set changes the available list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAgent?.id, kindFilter]);

  if (loading) {
    return <div className="text-muted-foreground p-6 text-sm">Loading tools…</div>;
  }

  if (error) {
    return (
      <div className="border-border bg-red-500/10 text-red-800 dark:text-red-200 m-4 rounded-lg border px-3 py-2 text-xs">
        {error}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border border-b px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
            Agent
          </span>
          <div className="border-border bg-muted/40 inline-flex flex-wrap rounded-lg border p-0.5">
            {agents.map((agent) => {
              const active = agent.id === (activeAgent?.id ?? agentId);
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => {
                    if (agent.id === agentId) return;
                    onAgentChange(agent.id);
                    onSelectTool(null);
                    setQuery("");
                    setKindFilter("all");
                  }}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  title={agent.description || undefined}
                >
                  {agent.label}
                  <span className="text-muted-foreground ml-1.5 tabular-nums">
                    {agent.coveredToolCount}/{agent.toolCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {activeAgent ? (
          <p className="text-muted-foreground mt-2 max-w-3xl text-xs leading-5">
            {activeAgent.description}{" "}
            <span className="text-muted-foreground/80">
              · {activeAgent.evalCount} evals in Spec ·{" "}
              {activeAgent.coveredToolCount} tools with gate coverage of{" "}
              {activeAgent.toolCount}
            </span>
          </p>
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className="border-border flex min-h-0 flex-col border-r">
          <div className="border-border space-y-2 border-b px-3 py-2">
            <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Tools ({filteredTools.length})
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter tools…"
              className="border-border bg-background focus:ring-foreground/20 w-full rounded-md border px-2 py-1.5 text-xs outline-none focus:ring-2"
            />
            <select
              value={kindFilter}
              onChange={(event) =>
                setKindFilter(
                  event.target.value as "all" | ToolsCatalogToolKind | "uncovered",
                )
              }
              className="border-border bg-background w-full rounded-md border px-2 py-1 text-xs"
            >
              <option value="all">All kinds</option>
              <option value="authored">Authored</option>
              <option value="subagent">Subagents</option>
              <option value="connection">Connections</option>
              <option value="builtin">Builtins</option>
              <option value="uncovered">No eval gates</option>
            </select>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto pb-4">
            {filteredTools.map((tool) => {
              const key = toolKey(tool);
              const active = key === selectedTool || tool.name === selectedTool;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => onSelectTool(key)}
                    className={cn(
                      "hover:bg-muted/70 w-full px-3 py-2 text-left transition-colors",
                      active && "bg-muted",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-xs font-medium">
                          {tool.name}
                        </span>
                        <span className="text-muted-foreground mt-0.5 block truncate text-[10px]">
                          {tool.connectionId
                            ? `${tool.connectionId} · ${tool.origin}`
                            : tool.origin}
                        </span>
                        <span className="mt-1 inline-flex">
                          <ToolUiSurfaceChip
                            toolName={tool.name}
                            toolKind={tool.kind}
                          />
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className={cn(
                            "rounded-md border border-transparent px-1.5 py-0.5 text-[10px] font-medium",
                            kindTone(tool.kind),
                          )}
                        >
                          {kindLabel(tool.kind)}
                        </span>
                        <span
                          className={cn(
                            "font-mono text-[10px] tabular-nums",
                            tool.evals.length > 0
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-muted-foreground",
                          )}
                        >
                          {tool.evals.length} eval
                          {tool.evals.length === 1 ? "" : "s"}
                        </span>
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
            {activeAgent && filteredTools.length === 0 ? (
              <li className="text-muted-foreground px-3 py-6 text-xs">
                No tools match this filter.
              </li>
            ) : null}
          </ul>
        </section>

        <main className="min-h-0 overflow-y-auto">
          {selected ? (
            <ToolDetail tool={selected} agentLabel={activeAgent?.label ?? agentId} />
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center p-8 text-sm">
              Select a tool to see its chat UI and eval coverage.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function toolKey(tool: ToolsCatalogTool): string {
  return tool.connectionId ? `${tool.connectionId}:${tool.name}` : tool.name;
}

function ToolDetail({
  tool,
  agentLabel,
}: {
  tool: ToolsCatalogTool;
  agentLabel: string;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-5">
      <div>
        <div className="text-muted-foreground font-mono text-[11px]">
          {agentLabel} · {tool.origin}
        </div>
        <h2 className="mt-0.5 font-mono text-lg font-semibold tracking-tight">
          {tool.name}
        </h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span
            className={cn(
              "rounded-md border border-transparent px-1.5 py-0.5 text-[10px] font-medium",
              kindTone(tool.kind),
            )}
          >
            {kindLabel(tool.kind)}
          </span>
          {tool.connectionId ? (
            <span className="border-border bg-muted/40 rounded-md border px-1.5 py-0.5 font-mono text-[10px]">
              {tool.connectionId}
            </span>
          ) : null}
        </div>
        <p className="text-muted-foreground mt-3 text-sm leading-6">
          {tool.description || "No description extracted."}
        </p>
      </div>

      <ToolUiPreview toolName={tool.name} toolKind={tool.kind} />

      <section>
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Eval coverage ({tool.evals.length})
        </h3>
        <p className="text-muted-foreground mt-1 mb-3 text-xs">
          Specs that gate on this tool via{" "}
          <code className="text-[11px]">calledTool</code> /{" "}
          <code className="text-[11px]">notCalledTool</code> (and related).
        </p>
        {tool.evals.length === 0 ? (
          <div className="border-border bg-muted/20 rounded-lg border px-3 py-3 text-xs">
            No eval gates reference <code className="text-[11px]">{tool.name}</code>{" "}
            yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {tool.evals.map((item) => (
              <li
                key={item.id}
                className="border-border overflow-hidden rounded-lg border"
              >
                <div className="px-3 py-2">
                  <div className="text-muted-foreground font-mono text-[10px]">
                    {item.suite}/
                  </div>
                  <div className="text-sm font-semibold tracking-tight">
                    {item.id}
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs leading-5">
                    {item.description || "No description."}
                  </p>
                </div>
                <div className="border-border flex flex-wrap gap-1 border-t px-3 py-2">
                  {item.gates.map((gate) => (
                    <span
                      key={gate}
                      className="border-border bg-sky-500/10 text-sky-950 dark:text-sky-100 rounded-md border px-1.5 py-0.5 font-mono text-[10px]"
                    >
                      {gate}
                    </span>
                  ))}
                </div>
                <div className="border-border bg-muted/20 border-t px-3 py-2">
                  <pre className="overflow-x-auto font-mono text-[11px]">
                    pnpm exec eve eval {item.id}
                  </pre>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
