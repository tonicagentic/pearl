"use client";

import { useMemo, useState } from "react";
import { AgentAccentMark } from "@/components/custom-agents/agent-identity-pill";
import {
  MARKETPLACE_EXAMPLES,
  type MarketplaceExample,
} from "@/components/marketing/marketplace-examples";
import { MarketingSection } from "@/components/marketing/section";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { marketingType } from "@/components/marketing/type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthMode } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

export function MarketplacePage({
  authMode,
  githubStars,
}: {
  readonly authMode: AuthMode;
  readonly githubStars: number | null;
}) {
  return (
    <MarketingShell
      authMode={authMode}
      callbackPath="/marketplace"
      githubStars={githubStars}
    >
      {({ onGetStarted }) => (
        <MarketplacePageContent onGetStarted={onGetStarted} />
      )}
    </MarketingShell>
  );
}

function MarketplacePageContent({
  onGetStarted,
}: {
  readonly onGetStarted: () => void;
}) {
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const row of MARKETPLACE_EXAMPLES) set.add(row.category);
    return ["All", ...[...set].sort((a, b) => a.localeCompare(b))];
  }, []);

  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MARKETPLACE_EXAMPLES.filter((row) => {
      if (category !== "All" && row.category !== category) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q) ||
        row.category.toLowerCase().includes(q)
      );
    });
  }, [category, query]);

  const featured = filtered.filter((row) => row.featured);
  const showFeatured = category === "All" && !query.trim() && featured.length > 0;

  return (
    <MarketingSection className="pt-28 sm:pt-32">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className={marketingType.sectionTitle}>Marketplace</h1>
        <p className={`mt-4 ${marketingType.body}`}>
          Ready-made roles you can add as custom agents. Sign in to install
          one into your Pearl.
        </p>
      </div>

      <div className="mx-auto mt-10 flex max-w-3xl flex-col gap-4">
        <div className="flex flex-wrap justify-center gap-1.5">
          {categories.map((name) => (
            <button
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                category === name
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
              key={name}
              onClick={() => setCategory(name)}
              type="button"
            >
              {name}
            </button>
          ))}
        </div>
        <Input
          className="rounded-full bg-card"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or description"
          value={query}
        />
      </div>

      {showFeatured ? (
        <div className="mx-auto mt-12 max-w-5xl">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Featured
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((row) => (
              <li key={row.slug}>
                <TemplateCard
                  example={row}
                  featured
                  onGetStarted={onGetStarted}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mx-auto mt-12 max-w-5xl">
        {showFeatured ? (
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            All roles
          </h2>
        ) : null}
        {filtered.length === 0 ? (
          <p className="mt-4 rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            No templates match.
          </p>
        ) : (
          <ul
            className={cn(
              "grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
              showFeatured ? "mt-4" : "mt-0",
            )}
          >
            {filtered.map((row) => (
              <li key={row.slug}>
                <TemplateCard example={row} onGetStarted={onGetStarted} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mx-auto mt-14 max-w-xl text-center">
        <p className={marketingType.caption}>
          After you sign in, add any role from Agents → Directory.
        </p>
        <Button
          className="mt-4 rounded-full"
          onClick={onGetStarted}
          type="button"
        >
          Get started
        </Button>
      </div>
    </MarketingSection>
  );
}

function TemplateCard({
  example,
  featured = false,
  onGetStarted,
}: {
  readonly example: MarketplaceExample;
  readonly featured?: boolean;
  readonly onGetStarted: () => void;
}) {
  return (
    <button
      className={cn(
        "flex h-full w-full flex-col items-start gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/40",
        featured ? "shadow-sm" : null,
      )}
      onClick={onGetStarted}
      type="button"
    >
      <div className="flex w-full items-start gap-3">
        <AgentAccentMark
          accent={example.accent}
          markBrows={example.markBrows}
          markGaze={example.markGaze}
          markShape={example.markShape}
          markTalk={example.markTalk}
          motion="burst"
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium tracking-tight text-foreground">
            {example.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {example.category} · by Pearl
          </p>
        </div>
      </div>
      <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
        {example.description}
      </p>
      <span className="mt-auto text-xs font-medium text-foreground">
        Get started →
      </span>
    </button>
  );
}
