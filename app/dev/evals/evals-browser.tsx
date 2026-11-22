"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { MarkdownContent } from "@/components/assistant-ui/elements/markdown-content";
import { cn } from "@/lib/utils";
import {
  parseJudgeMessage,
  type EvalAssertion,
  type EvalDetail,
  type EvalRunSummary,
  type EvalVerdict,
} from "@/lib/dev/eval-types";
import { CatalogView } from "./catalog-view";

type RunsResponse = { runs: EvalRunSummary[] };
type BrowserTab = "runs" | "catalog";

async function readApiError(res: Response): Promise<string> {
  const text = await res.text();
  if (text.trimStart().startsWith("<!DOCTYPE") || text.includes("<html")) {
    return `API ${res.status}: Next.js returned an HTML error page (often a stale compile). Hard-refresh or restart \`pnpm dev\`, then try again.`;
  }
  try {
    const json = JSON.parse(text) as { error?: string };
    if (json.error) return json.error;
  } catch {
    // fall through
  }
  return text.slice(0, 280) || `Request failed (${res.status})`;
}

function verdictTone(verdict: EvalVerdict): string {
  if (verdict === "passed") return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
  if (verdict === "failed") return "bg-red-500/15 text-red-800 dark:text-red-300";
  if (verdict === "scored") return "bg-amber-500/15 text-amber-900 dark:text-amber-200";
  if (verdict === "errored") return "bg-fuchsia-500/15 text-fuchsia-900 dark:text-fuchsia-200";
  return "bg-muted text-muted-foreground";
}

function formatWhen(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function suiteOf(evalId: string): string {
  const slash = evalId.indexOf("/");
  return slash === -1 ? evalId : evalId.slice(0, slash);
}

function scoreLabel(assertion: EvalAssertion): string {
  if (assertion.severity === "gate") {
    return assertion.passed ? "pass" : "fail";
  }
  const pct = Math.round(assertion.score * 100);
  const need = Math.round(assertion.threshold * 100);
  return `${pct}% ≥ ${need}%`;
}

function VerdictPill({ verdict }: { verdict: EvalVerdict }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium tracking-wide uppercase",
        verdictTone(verdict),
      )}
    >
      {verdict}
    </span>
  );
}

export function EvalsBrowser() {
  const [tab, setTab] = useState<BrowserTab>("runs");
  const [runs, setRuns] = useState<EvalRunSummary[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [evalId, setEvalId] = useState<string | null>(null);
  const [catalogId, setCatalogId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EvalDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [suiteFilter, setSuiteFilter] = useState<string>("all");
  const [verdictFilter, setVerdictFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("tab");
    if (view === "catalog" || view === "spec") setTab("catalog");
    const run = params.get("run");
    const id = params.get("id");
    if (run) setRunId(run);
    if (id && (view === "catalog" || view === "spec")) setCatalogId(id);
    else if (id) setEvalId(id);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (tab === "catalog") {
      params.set("tab", "catalog");
      if (catalogId) params.set("id", catalogId);
    } else if (runId) {
      params.set("run", runId);
      if (evalId) params.set("id", evalId);
    }
    const next = params.toString() ? `?${params.toString()}` : "";
    const href = `/dev/evals${next}`;
    if (`${window.location.pathname}${window.location.search}` !== href) {
      window.history.replaceState(null, "", href);
    }
  }, [tab, runId, evalId, catalogId]);

  const refreshRuns = useCallback(async () => {
    setLoadingRuns(true);
    setError(null);
    try {
      const res = await fetch("/api/dev/evals", { cache: "no-store" });
      if (!res.ok) throw new Error(await readApiError(res));
      const data = (await res.json()) as RunsResponse;
      setRuns(data.runs ?? []);
      setRunId((current) => current ?? data.runs?.[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load runs");
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  useEffect(() => {
    if (tab !== "runs") return;
    void refreshRuns();
  }, [tab, refreshRuns]);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === runId) ?? null,
    [runs, runId],
  );

  const suites = useMemo(() => {
    if (!selectedRun) return [];
    return [...new Set(selectedRun.evals.map((item) => suiteOf(item.id)))].sort();
  }, [selectedRun]);

  const filteredEvals = useMemo(() => {
    if (!selectedRun) return [];
    const q = query.trim().toLowerCase();
    return selectedRun.evals.filter((item) => {
      if (suiteFilter !== "all" && suiteOf(item.id) !== suiteFilter) return false;
      if (verdictFilter !== "all" && item.verdict !== verdictFilter) return false;
      if (q && !item.id.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [selectedRun, suiteFilter, verdictFilter, query]);

  useEffect(() => {
    if (!runId || !evalId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/dev/evals?run=${encodeURIComponent(runId)}&id=${encodeURIComponent(evalId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error(await readApiError(res));
        const data = (await res.json()) as EvalDetail;
        if (!cancelled) setDetail(data);
      } catch (err) {
        if (!cancelled) {
          setDetail(null);
          setError(err instanceof Error ? err.message : "Failed to load eval");
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId, evalId]);

  const selectRun = useCallback((id: string) => {
    setRunId(id);
    setEvalId(null);
    setSuiteFilter("all");
    setVerdictFilter("all");
    setQuery("");
  }, []);

  return (
    <div className="bg-background text-foreground flex h-dvh flex-col">
      <header className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-sm font-semibold tracking-tight">Eval browser</h1>
            <div className="border-border bg-muted/40 inline-flex rounded-lg border p-0.5">
              <button
                type="button"
                onClick={() => setTab("runs")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  tab === "runs"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Runs
              </button>
              <button
                type="button"
                onClick={() => setTab("catalog")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  tab === "catalog"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Spec
              </button>
            </div>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {tab === "catalog"
              ? "Documentation of suites, evals, and assertions from source"
              : "Local run artifacts from"}{" "}
            {tab === "runs" ? (
              <code className="text-[11px]">.eve/evals</code>
            ) : (
              <code className="text-[11px]">evals/**/*.eval.ts</code>
            )}
          </p>
        </div>
        {tab === "runs" ? (
          <button
            type="button"
            onClick={() => void refreshRuns()}
            className="border-border hover:bg-muted rounded-md border px-2.5 py-1 text-xs font-medium"
          >
            Refresh
          </button>
        ) : null}
      </header>

      {error && tab === "runs" ? (
        <div className="border-border bg-red-500/10 text-red-800 dark:text-red-200 border-b px-4 py-2 text-xs">
          {error}
        </div>
      ) : null}

      {tab === "catalog" ? (
        <CatalogView selectedId={catalogId} onSelect={setCatalogId} />
      ) : (
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[220px_300px_minmax(0,1fr)]">
        {/* Runs */}
        <aside className="border-border min-h-0 overflow-y-auto border-r">
          <div className="text-muted-foreground px-3 py-2 text-[11px] font-medium tracking-wide uppercase">
            Runs {loadingRuns ? "…" : `(${runs.length})`}
          </div>
          <ul className="pb-4">
            {runs.map((run) => {
              const active = run.id === runId;
              return (
                <li key={run.id}>
                  <button
                    type="button"
                    onClick={() => selectRun(run.id)}
                    className={cn(
                      "hover:bg-muted/70 w-full px-3 py-2 text-left transition-colors",
                      active && "bg-muted",
                    )}
                  >
                    <div className="font-mono text-[11px] leading-tight">{run.id}</div>
                    <div className="text-muted-foreground mt-1 flex flex-wrap gap-1.5 text-[11px]">
                      <span className="text-emerald-700 dark:text-emerald-300">
                        {run.passed}✓
                      </span>
                      <span className="text-red-700 dark:text-red-300">
                        {run.failed}✗
                      </span>
                      {run.scored > 0 ? (
                        <span className="text-amber-800 dark:text-amber-200">
                          {run.scored}○
                        </span>
                      ) : null}
                      <span>· {run.totalEvals} total</span>
                    </div>
                  </button>
                </li>
              );
            })}
            {!loadingRuns && runs.length === 0 ? (
              <li className="text-muted-foreground px-3 py-6 text-xs">
                No runs yet. Try{" "}
                <code className="text-[11px]">pnpm exec eve eval …</code>
              </li>
            ) : null}
          </ul>
        </aside>

        {/* Eval list */}
        <section className="border-border flex min-h-0 flex-col border-r">
          <div className="border-border space-y-2 border-b px-3 py-2">
            <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              {selectedRun ? formatWhen(selectedRun.completedAt ?? selectedRun.startedAt) : "Evals"}
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by id…"
              className="border-border bg-background focus:ring-foreground/20 w-full rounded-md border px-2 py-1.5 text-xs outline-none focus:ring-2"
            />
            <div className="flex gap-2">
              <select
                value={suiteFilter}
                onChange={(event) => setSuiteFilter(event.target.value)}
                className="border-border bg-background flex-1 rounded-md border px-2 py-1 text-xs"
              >
                <option value="all">All suites</option>
                {suites.map((suite) => (
                  <option key={suite} value={suite}>
                    {suite}
                  </option>
                ))}
              </select>
              <select
                value={verdictFilter}
                onChange={(event) => setVerdictFilter(event.target.value)}
                className="border-border bg-background w-[110px] rounded-md border px-2 py-1 text-xs"
              >
                <option value="all">All</option>
                <option value="passed">passed</option>
                <option value="failed">failed</option>
                <option value="scored">scored</option>
                <option value="errored">errored</option>
              </select>
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto pb-4">
            {filteredEvals.map((item) => {
              const active = item.id === evalId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setEvalId(item.id)}
                    className={cn(
                      "hover:bg-muted/70 flex w-full items-start justify-between gap-2 px-3 py-2 text-left transition-colors",
                      active && "bg-muted",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="text-muted-foreground block text-[10px]">
                        {suiteOf(item.id)}
                      </span>
                      <span className="block truncate text-xs font-medium">
                        {item.id.includes("/")
                          ? item.id.slice(item.id.indexOf("/") + 1)
                          : item.id}
                      </span>
                    </span>
                    <VerdictPill verdict={item.verdict} />
                  </button>
                </li>
              );
            })}
            {selectedRun && filteredEvals.length === 0 ? (
              <li className="text-muted-foreground px-3 py-6 text-xs">
                No evals match this filter.
              </li>
            ) : null}
          </ul>
        </section>

        {/* Detail */}
        <main className="min-h-0 overflow-y-auto">
          {!evalId ? (
            <div className="text-muted-foreground flex h-full items-center justify-center p-8 text-sm">
              Select an eval to inspect assertions, transcript, and tools.
            </div>
          ) : loadingDetail ? (
            <div className="text-muted-foreground p-6 text-sm">Loading…</div>
          ) : detail ? (
            <EvalDetailView detail={detail} />
          ) : (
            <div className="text-muted-foreground p-6 text-sm">
              Could not load this eval.
            </div>
          )}
        </main>
      </div>
      )}
    </div>
  );
}

function EvalDetailView({ detail }: { detail: EvalDetail }) {
  const gates = detail.assertions.filter((a) => a.severity === "gate");
  const soft = detail.assertions.filter((a) => a.severity !== "gate");
  const failed = detail.assertions.filter((a) => !a.passed);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-muted-foreground font-mono text-[11px]">
            {detail.runId}
          </div>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight">
            {detail.id}
          </h2>
          <div className="text-muted-foreground mt-1 text-xs">
            {formatWhen(detail.startedAt)} → {formatWhen(detail.completedAt)}
          </div>
        </div>
        <VerdictPill verdict={detail.verdict} />
      </div>

      {failed.length > 0 ? (
        <section className="border-border bg-red-500/5 rounded-lg border p-3">
          <h3 className="text-xs font-semibold tracking-wide uppercase">
            Failures ({failed.length})
          </h3>
          <ul className="mt-2 space-y-2">
            {failed.map((assertion, index) => (
              <AssertionRow key={`${assertion.name}-${index}`} assertion={assertion} />
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Gates ({gates.filter((a) => a.passed).length}/{gates.length})
        </h3>
        <ul className="mt-2 divide-border border-border divide-y rounded-lg border">
          {gates.map((assertion, index) => (
            <AssertionRow key={`g-${assertion.name}-${index}`} assertion={assertion} />
          ))}
          {gates.length === 0 ? (
            <li className="text-muted-foreground px-3 py-2 text-xs">No gates</li>
          ) : null}
        </ul>
      </section>

      <section>
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Judges / soft ({soft.filter((a) => a.passed).length}/{soft.length})
        </h3>
        <ul className="mt-2 space-y-3">
          {soft.map((assertion, index) => (
            <SoftAssertionCard
              key={`s-${assertion.name}-${index}`}
              assertion={assertion}
            />
          ))}
          {soft.length === 0 ? (
            <li className="text-muted-foreground text-xs">No soft assertions</li>
          ) : null}
        </ul>
      </section>

      {(detail.skillLoads.length > 0 || detail.toolCalls.length > 0) && (
        <section className="grid gap-3 sm:grid-cols-2">
          <div>
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Skills
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {detail.skillLoads.length === 0 ? (
                <span className="text-muted-foreground text-xs">None</span>
              ) : (
                [...new Set(detail.skillLoads.map((s) => s.skill))].map((skill) => (
                  <span
                    key={skill}
                    className="border-border bg-muted/40 rounded-md border px-2 py-0.5 font-mono text-[11px]"
                  >
                    {skill}
                  </span>
                ))
              )}
            </div>
          </div>
          <div>
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Tools
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {detail.toolCalls.length === 0 ? (
                <span className="text-muted-foreground text-xs">None</span>
              ) : (
                detail.toolCalls.map((call, index) => (
                  <span
                    key={`${call.name}-${index}`}
                    className={cn(
                      "border-border rounded-md border px-2 py-0.5 font-mono text-[11px]",
                      call.status === "failed"
                        ? "bg-red-500/10 text-red-800 dark:text-red-200"
                        : "bg-muted/40",
                    )}
                    title={
                      call.input
                        ? JSON.stringify(call.input).slice(0, 400)
                        : undefined
                    }
                  >
                    {call.name}
                  </span>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      <section>
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Transcript ({detail.turns.length || (detail.reply ? 1 : 0)} turns)
        </h3>
        <div className="mt-2 space-y-4">
          {detail.turns.length > 0
            ? detail.turns.map((turn) => (
                <div
                  key={turn.turnId}
                  className="border-border divide-border divide-y overflow-hidden rounded-lg border"
                >
                  <div className="bg-muted/30 text-muted-foreground px-3 py-1.5 font-mono text-[10px]">
                    {turn.turnId}
                    {turn.skills.length
                      ? ` · skills ${turn.skills.join(", ")}`
                      : ""}
                    {turn.tools.length
                      ? ` · tools ${turn.tools.map((t) => t.name).join(", ")}`
                      : ""}
                  </div>
                  {turn.userText ? (
                    <div className="px-3 py-3">
                      <div className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase">
                        User
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-[13px] leading-5">
                        {turn.userText}
                      </pre>
                    </div>
                  ) : null}
                  {turn.replyText ? (
                    <div className="px-3 py-3">
                      <div className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase">
                        Assistant
                      </div>
                      <div className="text-[13px] leading-5">
                        <MarkdownContent text={turn.replyText} />
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
            : detail.reply ? (
                <div className="border-border rounded-lg border px-3 py-3">
                  <div className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase">
                    Final reply
                  </div>
                  <div className="text-[13px] leading-5">
                    <MarkdownContent text={detail.reply} />
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">No transcript.</p>
              )}
        </div>
      </section>
    </div>
  );
}

function AssertionRow({ assertion }: { assertion: EvalAssertion }) {
  return (
    <li className="flex items-start justify-between gap-3 px-3 py-2 text-xs">
      <div className="min-w-0">
        <div className="font-medium">{assertion.name}</div>
        {assertion.key ? (
          <div className="text-muted-foreground font-mono text-[10px]">
            {assertion.key}
          </div>
        ) : null}
      </div>
      <div
        className={cn(
          "shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px]",
          assertion.passed
            ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
            : "bg-red-500/10 text-red-800 dark:text-red-300",
        )}
      >
        {scoreLabel(assertion)}
      </div>
    </li>
  );
}

function SoftAssertionCard({ assertion }: { assertion: EvalAssertion }) {
  const parsed = parseJudgeMessage(assertion.message);
  return (
    <li
      className={cn(
        "border-border overflow-hidden rounded-lg border",
        !assertion.passed && "border-red-500/40",
      )}
    >
      <div className="flex items-start justify-between gap-3 px-3 py-2">
        <div>
          <div className="text-xs font-medium">{assertion.name}</div>
          {parsed.instructions ? (
            <p className="text-muted-foreground mt-1 text-[11px] leading-4">
              {parsed.instructions}
            </p>
          ) : null}
        </div>
        <div
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px]",
            assertion.passed
              ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
              : "bg-red-500/10 text-red-800 dark:text-red-300",
          )}
        >
          {scoreLabel(assertion)}
        </div>
      </div>
      {(parsed.input || parsed.output) && (
        <div className="border-border grid gap-0 border-t sm:grid-cols-2">
          {parsed.input ? (
            <div className="border-border px-3 py-2 sm:border-r">
              <div className="text-muted-foreground mb-1 text-[10px] uppercase">
                Judge input
              </div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-sans text-[11px] leading-4">
                {parsed.input}
              </pre>
            </div>
          ) : null}
          {parsed.output ? (
            <div className="px-3 py-2">
              <div className="text-muted-foreground mb-1 text-[10px] uppercase">
                Graded output
              </div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-sans text-[11px] leading-4">
                {parsed.output}
              </pre>
            </div>
          ) : null}
        </div>
      )}
    </li>
  );
}
