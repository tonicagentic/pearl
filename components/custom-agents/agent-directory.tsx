"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AddTemplateButton } from "@/components/custom-agents/add-template-button";
import { AgentAccentMark } from "@/components/custom-agents/agent-identity-pill";
import { Input } from "@/components/ui/input";
import type { AgentTemplateSummary } from "@/lib/custom-agents/template-types";
import { cn } from "@/lib/utils";

export function AgentDirectory({
  templates,
}: {
  readonly templates: readonly AgentTemplateSummary[];
}) {
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const row of templates) set.add(row.category);
    return ["All", ...[...set].sort((a, b) => a.localeCompare(b))];
  }, [templates]);

  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((row) => {
      if (category !== "All" && row.category !== category) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q) ||
        row.category.toLowerCase().includes(q)
      );
    });
  }, [templates, category, query]);

  const featured = filtered.filter((row) => row.featured);
  const byCategory = useMemo(() => {
    const map = new Map<string, AgentTemplateSummary[]>();
    for (const row of filtered) {
      const list = map.get(row.category) ?? [];
      list.push(row);
      map.set(row.category, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-sm font-semibold">Directory</h2>
        <p className="text-sm text-muted-foreground">
          Ready-made roles you can add as custom agents.
        </p>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {categories.map((name) => (
          <button
            key={name}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              category === name
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:bg-muted/50",
            )}
            onClick={() => setCategory(name)}
            type="button"
          >
            {name}
          </button>
        ))}
      </div>

      <Input
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name or description"
        value={query}
      />

      {featured.length > 0 && category === "All" && !query.trim() ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Featured
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {featured.map((row) => (
              <Link
                key={row.slug}
                className="flex items-start gap-3 rounded-lg border bg-card p-3 hover:bg-muted/40"
                href={`/agents/directory/${row.slug}`}
              >
                <AgentAccentMark
                  accent={row.accent}
                  markShape={row.markShape}
                  markTalk={row.markTalk}
                  markBrows={row.markBrows}
                  markGaze={row.markGaze}
                  size="lg"
                  motion="burst"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{row.name}</div>
                  <div className="text-xs text-muted-foreground">by Pearl</div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {row.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {byCategory.length === 0 ? (
        <p className="rounded-lg border bg-card px-3 py-4 text-sm text-muted-foreground">
          No templates match.
        </p>
      ) : (
        byCategory.map(([name, rows]) => (
          <div key={name} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {name}
              </h3>
            </div>
            <ul className="divide-y rounded-lg border bg-card">
              {rows.map((row) => (
                <li
                  key={row.slug}
                  className="flex items-center gap-3 px-3 py-3"
                >
                  <Link
                    className="flex min-w-0 flex-1 items-center gap-2.5 hover:opacity-90"
                    href={`/agents/directory/${row.slug}`}
                  >
                    <AgentAccentMark
                      accent={row.accent}
                      markShape={row.markShape}
                      markTalk={row.markTalk}
                      markBrows={row.markBrows}
                      markGaze={row.markGaze}
                      size="md"
                      motion="burst"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {row.name}{" "}
                        <span className="font-normal text-muted-foreground">
                          by Pearl
                        </span>
                      </div>
                      <div className="line-clamp-1 text-xs text-muted-foreground">
                        {row.description}
                      </div>
                    </div>
                  </Link>
                  <AddTemplateButton
                    addedChatId={row.addedChatId}
                    slug={row.slug}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
