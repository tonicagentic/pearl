"use client";

import { useEffect, useMemo, useState } from "react";

import { suiteFromEvalRelPath } from "@/lib/dev/eval-agents";
import { cn } from "@/lib/utils";
import type {
  CatalogAgent,
  CatalogAssertion,
  CatalogCase,
  CatalogEval,
  CatalogFixture,
  CatalogSuite,
  CatalogTurn,
} from "@/lib/dev/eval-catalog-types";

type CatalogResponse = { agents?: CatalogAgent[]; suites: CatalogSuite[] };

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

function assertionTitle(assertion: CatalogAssertion): string {
  if (assertion.kind === "judge") {
    const threshold =
      typeof assertion.threshold === "number"
        ? ` ≥ ${Math.round(assertion.threshold * 100)}%`
        : "";
    return (assertion.label ? assertion.label : "judge") + threshold;
  }
  if (assertion.kind === "gate") return assertion.name;
  return "t.check";
}

function agentsFromResponse(data: CatalogResponse): CatalogAgent[] {
  if (data.agents && data.agents.length > 0) return data.agents;
  const byAgent = new Map<string, CatalogSuite[]>();
  for (const suite of data.suites ?? []) {
    const agent = suite.agent || "pearl";
    const list = byAgent.get(agent) ?? [];
    list.push(suite);
    byAgent.set(agent, list);
  }
  return [...byAgent.entries()].map(([id, suites]) => ({
    id,
    label: id === "pearl" ? "Pearl" : id[0]!.toUpperCase() + id.slice(1),
    description: "",
    suites,
  }));
}

export function CatalogView({
  selectedId,
  onSelect,
  agentId,
  onAgentChange,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  agentId: string;
  onAgentChange: (id: string) => void;
}) {
  const [agents, setAgents] = useState<CatalogAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suiteId, setSuiteId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/dev/evals?catalog=1", { cache: "no-store" });
        if (!res.ok) throw new Error(await readApiError(res));
        const data = (await res.json()) as CatalogResponse;
        if (cancelled) return;
        const nextAgents = agentsFromResponse(data);
        setAgents(nextAgents);
        if (!nextAgents.some((agent) => agent.id === agentId)) {
          onAgentChange(nextAgents[0]?.id ?? "pearl");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load catalog");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Load once; agentId sync handled below / by parent URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeAgent = useMemo(
    () => agents.find((agent) => agent.id === agentId) ?? agents[0] ?? null,
    [agents, agentId],
  );

  const suites = activeAgent?.suites ?? [];

  useEffect(() => {
    if (suites.length === 0) {
      setSuiteId(null);
      return;
    }
    setSuiteId((current) =>
      current && suites.some((suite) => suite.id === current)
        ? current
        : (suites[0]?.id ?? null),
    );
  }, [suites]);

  useEffect(() => {
    if (!selectedId || agents.length === 0) return;
    const suite = suiteFromEvalRelPath(`${selectedId}.eval.ts`).suite;
    for (const agent of agents) {
      if (agent.suites.some((item) => item.id === suite)) {
        if (agent.id !== agentId) onAgentChange(agent.id);
        setSuiteId(suite);
        break;
      }
    }
  }, [selectedId, agents, agentId, onAgentChange]);

  const selectedSuite = useMemo(
    () => suites.find((suite) => suite.id === suiteId) ?? null,
    [suites, suiteId],
  );

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const suite of suites) {
      for (const item of suite.evals) {
        for (const tag of item.tags) set.add(tag);
      }
    }
    return [...set].sort();
  }, [suites]);

  const filteredEvals = useMemo(() => {
    if (!selectedSuite) return [];
    const q = query.trim().toLowerCase();
    return selectedSuite.evals.filter((item) => {
      if (tagFilter !== "all" && !item.tags.includes(tagFilter)) return false;
      if (!q) return true;
      const hay = `${item.id} ${item.description} ${item.cases
        .map((c) => `${c.label} ${c.description}`)
        .join(" ")} ${(item.fixtures ?? [])
        .map((f) => `${f.name} ${f.text ?? ""} ${Object.values(f.fields ?? {}).join(" ")}`)
        .join(" ")} ${item.prompts.join(" ")} ${item.assertions
        .map((a) => assertionTitle(a))
        .join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [selectedSuite, query, tagFilter]);

  const selectedEval = useMemo(() => {
    if (!selectedId) return null;
    for (const suite of suites) {
      const found = suite.evals.find((item) => item.id === selectedId);
      if (found) return found;
    }
    // Selected id may belong to another agent until switch completes.
    for (const agent of agents) {
      for (const suite of agent.suites) {
        const found = suite.evals.find((item) => item.id === selectedId);
        if (found) return found;
      }
    }
    return null;
  }, [suites, selectedId, agents]);

  if (loading) {
    return <div className="text-muted-foreground p-6 text-sm">Loading catalog…</div>;
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
              const count = agent.suites.reduce(
                (sum, suite) => sum + suite.evals.length,
                0,
              );
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => {
                    if (agent.id === agentId) return;
                    onAgentChange(agent.id);
                    onSelect(null);
                    setQuery("");
                    setTagFilter("all");
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
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {activeAgent?.description ? (
          <p className="text-muted-foreground mt-2 max-w-3xl text-xs leading-5">
            {activeAgent.description}
          </p>
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[200px_280px_minmax(0,1fr)]">
      <aside className="border-border min-h-0 overflow-y-auto border-r">
        <div className="text-muted-foreground px-3 py-2 text-[11px] font-medium tracking-wide uppercase">
          Suites ({suites.length})
        </div>
        <ul className="pb-4">
          {suites.map((suite) => {
            const active = suite.id === suiteId;
            return (
              <li key={suite.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSuiteId(suite.id);
                    onSelect(null);
                  }}
                  className={cn(
                    "hover:bg-muted/70 w-full px-3 py-2 text-left transition-colors",
                    active && "bg-muted",
                  )}
                >
                  <div className="text-xs font-medium">{suite.id}</div>
                  <div className="text-muted-foreground mt-0.5 line-clamp-2 text-[11px]">
                    {suite.title !== suite.id ? suite.title : `${suite.evals.length} evals`}
                  </div>
                </button>
              </li>
            );
          })}
          {suites.length === 0 ? (
            <li className="text-muted-foreground px-3 py-6 text-xs">
              No suites for this agent yet.
            </li>
          ) : null}
        </ul>
      </aside>

      <section className="border-border flex min-h-0 flex-col border-r">
        <div className="border-border space-y-2 border-b px-3 py-2">
          <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
            Specs
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search evals & inputs…"
            className="border-border bg-background focus:ring-foreground/20 w-full rounded-md border px-2 py-1.5 text-xs outline-none focus:ring-2"
          />
          <select
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
            className="border-border bg-background w-full rounded-md border px-2 py-1 text-xs"
          >
            <option value="all">All tags</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto pb-4">
          {filteredEvals.map((item) => {
            const active = item.id === selectedId;
            const judges = item.assertions.filter((a) => a.kind === "judge").length;
            const gates = item.assertions.filter((a) => a.kind === "gate").length;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    "hover:bg-muted/70 w-full px-3 py-2 text-left transition-colors",
                    active && "bg-muted",
                  )}
                >
                  <div className="truncate text-xs font-medium">{item.name}</div>
                  <div className="text-muted-foreground mt-0.5 text-[11px]">
                    {gates} gates · {judges} judges
                    {item.tags.length ? ` · ${item.tags.join(", ")}` : ""}
                  </div>
                  {item.prompts[0] ? (
                    <p className="text-muted-foreground mt-1.5 line-clamp-2 text-[10px] leading-3.5">
                      {item.prompts[0]}
                    </p>
                  ) : null}
                </button>
              </li>
            );
          })}
          {selectedSuite && filteredEvals.length === 0 ? (
            <li className="text-muted-foreground px-3 py-6 text-xs">
              No evals match this filter.
            </li>
          ) : null}
        </ul>
      </section>

      <main className="min-h-0 overflow-y-auto">
        {selectedEval ? (
          <CatalogEvalDoc item={selectedEval} suite={selectedSuite} />
        ) : selectedSuite ? (
          <SuiteOverview suite={selectedSuite} onSelect={onSelect} />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center p-8 text-sm">
            Select a suite to read how we evaluate it.
          </div>
        )}
      </main>
      </div>
    </div>
  );
}


function SuiteOverview({
  suite,
  onSelect,
}: {
  suite: CatalogSuite;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-5 py-5">
      <div>
        <div className="text-muted-foreground font-mono text-[11px]">{suite.id}/</div>
        <h2 className="mt-0.5 text-lg font-semibold tracking-tight">{suite.title}</h2>
        {suite.blurb ? (
          <div className="text-muted-foreground mt-2 space-y-3 text-sm leading-6">
            {suite.blurb.split(/\n\n+/).map((paragraph, index) => (
              <p key={index} className="whitespace-pre-wrap">
                {paragraph}
              </p>
            ))}
          </div>
        ) : null}
      </div>
      {(suite.fixtures ?? []).length > 0 ? (
        <section>
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Suite fixtures
          </h3>
          <p className="text-muted-foreground mt-1 mb-3 text-xs">
            Shared data under evals/{suite.id}/fixtures/ — used across cases in
            this suite.
          </p>
          <FixturesList fixtures={suite.fixtures ?? []} compact />
        </section>
      ) : null}
      <section className="space-y-4">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Evals in this suite ({suite.evals.length})
        </h3>
        {suite.evals.map((item) => (
          <article
            key={item.id}
            id={item.id}
            className="border-border overflow-hidden rounded-lg border"
          >
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className="hover:bg-muted/40 w-full px-3 py-3 text-left transition-colors"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold tracking-tight">{item.name}</h4>
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="border-border bg-muted/40 rounded-md border px-1.5 py-0.5 font-mono text-[10px]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <p className="text-muted-foreground mt-1.5 text-xs leading-5">
                {item.description || "No description."}
              </p>
            </button>
            <div className="border-border space-y-3 border-t px-3 py-2">
              <CasesList
                cases={item.cases ?? []}
                fixtures={item.fixtures ?? []}
                compact
              />
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function FixturesList({
  fixtures,
  compact = false,
}: {
  fixtures: CatalogFixture[];
  compact?: boolean;
}) {
  if (fixtures.length === 0) return null;

  return (
    <div>
      <div className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wide uppercase">
        Fixtures ({fixtures.length})
      </div>
      <ul className="space-y-2">
        {fixtures.map((fixture) => (
          <li
            key={`${fixture.source}-${fixture.name}`}
            className="border-border bg-muted/20 rounded-md border px-2.5 py-2"
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-mono text-[12px] font-medium">
                {fixture.name}
              </span>
              <span className="text-muted-foreground font-mono text-[10px]">
                {fixture.source}
              </span>
            </div>
            {fixture.kind === "record" && fixture.fields ? (
              <dl
                className={cn(
                  "mt-1.5 grid gap-x-3 gap-y-1 text-[12px] leading-5",
                  "grid-cols-[auto_minmax(0,1fr)]",
                )}
              >
                {Object.entries(fixture.fields).map(([key, value]) => (
                  <div key={key} className="contents">
                    <dt className="text-muted-foreground font-mono text-[10px]">
                      {key}
                    </dt>
                    <dd
                      className={cn(
                        "whitespace-pre-wrap",
                        compact && "line-clamp-3",
                      )}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {fixture.kind === "text" && fixture.text ? (
              <pre
                className={cn(
                  "mt-1.5 whitespace-pre-wrap font-sans text-[12px] leading-5",
                  compact && "line-clamp-4",
                )}
              >
                {fixture.text}
              </pre>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function gateChipLabel(assertion: CatalogAssertion): string {
  if (assertion.kind === "gate") return assertion.name;
  if (assertion.kind === "judge") {
    const threshold =
      typeof assertion.threshold === "number"
        ? ` ≥${Math.round(assertion.threshold * 100)}%`
        : "";
    return (assertion.label ?? "judge") + threshold;
  }
  return "check";
}

function TurnCard({
  turn,
  compact = false,
  caseKey,
  fixtures = [],
}: {
  turn: CatalogTurn;
  compact?: boolean;
  caseKey: string;
  fixtures?: CatalogFixture[];
}) {
  const gates = turn.assertions.filter((a) => a.kind === "gate");
  const judges = turn.assertions.filter((a) => a.kind === "judge");
  const checks = turn.assertions.filter((a) => a.kind === "check");
  const primaryJudge = judges[0];
  const attached = (turn.fixtureNames ?? [])
    .map((name) => fixtures.find((fixture) => fixture.name === name))
    .filter((fixture): fixture is CatalogFixture => Boolean(fixture));

  return (
    <div className="border-border bg-muted/20 rounded-md border px-2.5 py-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-muted-foreground font-mono text-[10px]">
          turn {turn.index}
        </span>
        {primaryJudge?.kind === "judge" && primaryJudge.label ? (
          <span className="text-[12px] font-medium leading-4">
            {primaryJudge.label}
          </span>
        ) : null}
      </div>
      {(turn.fixtureNames ?? []).length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {(turn.fixtureNames ?? []).map((name) => (
            <span
              key={`${caseKey}-fix-${turn.index}-${name}`}
              className="border-border bg-violet-500/10 text-violet-950 dark:text-violet-100 rounded-md border px-1.5 py-0.5 font-mono text-[10px]"
            >
              {name}
            </span>
          ))}
        </div>
      ) : null}
      {!compact && attached.length > 0 ? (
        <div className="mt-2">
          <FixturesList fixtures={attached} />
        </div>
      ) : null}
      <pre
        className={cn(
          "mt-1.5 whitespace-pre-wrap font-sans text-[12px] leading-5",
          compact && "line-clamp-3",
        )}
      >
        {turn.prompt}
      </pre>
      {turn.assertions.length > 0 ? (
        <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
          {judges.map((assertion, index) => (
            <div
              key={`j-${caseKey}-${turn.index}-${index}`}
              className="border-border bg-background rounded-md border px-2 py-1.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium">
                  {assertion.kind === "judge" && assertion.label
                    ? assertion.label
                    : "judge"}
                </span>
                {assertion.kind === "judge" &&
                typeof assertion.threshold === "number" ? (
                  <span className="text-muted-foreground font-mono text-[10px]">
                    ≥ {Math.round(assertion.threshold * 100)}%
                  </span>
                ) : null}
              </div>
              {assertion.kind === "judge" ? (
                <p
                  className={cn(
                    "text-muted-foreground mt-1 text-[11px] leading-4",
                    compact && "line-clamp-3",
                  )}
                >
                  {assertion.instructions}
                </p>
              ) : null}
            </div>
          ))}
          {gates.length > 0 || checks.length > 0 ? (
            <ul className="flex flex-wrap gap-1">
              {gates.map((assertion, index) => (
                <li
                  key={`g-${caseKey}-${turn.index}-${index}`}
                  className="border-border bg-sky-500/10 text-sky-950 dark:text-sky-100 rounded-md border px-1.5 py-0.5 font-mono text-[10px]"
                >
                  {gateChipLabel(assertion)}
                </li>
              ))}
              {checks.map((assertion, index) => (
                <li
                  key={`c-${caseKey}-${turn.index}-${index}`}
                  className="border-border bg-amber-500/10 text-amber-950 dark:text-amber-100 rounded-md border px-1.5 py-0.5 font-mono text-[10px]"
                  title={assertion.kind === "check" ? assertion.detail : undefined}
                >
                  {assertion.kind === "check"
                    ? assertion.detail.slice(0, 48) +
                      (assertion.detail.length > 48 ? "…" : "")
                    : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="text-muted-foreground mt-2 text-[10px]">
          No checks attached to this turn.
        </p>
      )}
    </div>
  );
}

function CasesList({
  cases,
  fixtures = [],
  compact = false,
}: {
  cases: CatalogCase[];
  fixtures?: CatalogFixture[];
  compact?: boolean;
}) {
  if (cases.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        No cases extracted from the eval source.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
        Cases ({cases.length})
      </div>
      {cases.map((item) => {
        const caseFixtureNames = [
          ...new Set(item.turns.flatMap((turn) => turn.fixtureNames ?? [])),
        ];
        return (
          <div key={`case-${item.index}`} className="space-y-2">
            <div>
              <div className="text-muted-foreground font-mono text-[10px]">
                case {item.index}
                {item.turns.length > 1 ? ` · ${item.turns.length} turns` : ""}
              </div>
              <div className="text-[13px] font-medium leading-5">{item.label}</div>
              {item.description ? (
                <p className="text-muted-foreground mt-1 text-xs leading-5">
                  {item.description}
                </p>
              ) : null}
              {caseFixtureNames.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {caseFixtureNames.map((name) => (
                    <span
                      key={`case-${item.index}-fix-${name}`}
                      className="border-border bg-violet-500/10 text-violet-950 dark:text-violet-100 rounded-md border px-1.5 py-0.5 font-mono text-[10px]"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <ul className="space-y-2">
              {item.turns.map((turn) => (
                <li key={`case-${item.index}-turn-${turn.index}`}>
                  <TurnCard
                    turn={turn}
                    compact={compact}
                    caseKey={`case-${item.index}`}
                    fixtures={fixtures}
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function CatalogEvalDoc({
  item,
  suite,
}: {
  item: CatalogEval;
  suite: CatalogSuite | null;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-5">
      <div>
        <div className="text-muted-foreground font-mono text-[11px]">
          {suite ? `${suite.id}/` : ""}
          {item.name}
        </div>
        <h2 className="mt-0.5 text-lg font-semibold tracking-tight">{item.id}</h2>
        <div className="text-muted-foreground mt-1 flex flex-wrap gap-2 text-[11px]">
          <span className="font-mono">{item.file}</span>
          {item.timeoutMs ? <span>· timeout {Math.round(item.timeoutMs / 1000)}s</span> : null}
        </div>
        {item.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="border-border bg-muted/40 rounded-md border px-1.5 py-0.5 font-mono text-[10px]"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <section>
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          What this eval pins
        </h3>
        <p className="mt-2 text-sm leading-6">
          {item.description || "No description in defineEval()."}
        </p>
      </section>

      {(item.fixtures ?? []).length > 0 ? (
        <section>
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Fixtures used here
          </h3>
          <p className="text-muted-foreground mt-1 mb-3 text-xs">
            Named data this eval imports or defines — offer/ICP records, prompts,
            and local consts beyond the raw send() text.
          </p>
          <FixturesList fixtures={item.fixtures ?? []} />
        </section>
      ) : null}

      <section>
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Cases & checks
        </h3>
        <p className="text-muted-foreground mt-1 mb-3 text-xs">
          Cases are independent sessions. Turns are sends inside one conversation.
          Gates are mechanical; judges are quality rubrics (usually ≥ 80%).
        </p>
        <CasesList cases={item.cases ?? []} fixtures={item.fixtures ?? []} />
      </section>

      <section className="border-border bg-muted/20 rounded-lg border px-3 py-2">
        <div className="text-muted-foreground text-[11px]">
          Run this eval locally:
        </div>
        <pre className="mt-1 overflow-x-auto font-mono text-[11px]">
          pnpm exec eve eval {item.id}
        </pre>
      </section>
    </div>
  );
}
