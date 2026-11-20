"use client";

import Link from "next/link";
import { AgentAccentMark } from "@/components/custom-agents/agent-identity-pill";
import {
  MARKETPLACE_EXAMPLES,
  type MarketplaceExample,
} from "@/components/marketing/marketplace-examples";
import { MarketingContainer } from "@/components/marketing/section";
import { marketingType } from "@/components/marketing/type";
import { usePrefersReducedMotion } from "@/components/marketing/use-prefers-reduced-motion";
import { Button } from "@/components/ui/button";

function EmployeeCard({
  example,
}: {
  readonly example: MarketplaceExample;
}) {
  return (
    <article className="flex w-[min(300px,78vw)] shrink-0 flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-none">
      <div className="flex items-center gap-3">
        <AgentAccentMark
          accent={example.accent}
          markBrows={example.markBrows}
          markGaze={example.markGaze}
          markShape={example.markShape}
          markTalk={example.markTalk}
          motion="off"
          size="lg"
        />
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {example.category}
          </p>
          <h3 className="truncate text-base font-medium tracking-tight text-foreground">
            {example.name}
          </h3>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
        {example.description}
      </p>
    </article>
  );
}

function TickerTrack({
  examples,
  ariaHidden = false,
  keyPrefix = "",
}: {
  readonly examples: readonly MarketplaceExample[];
  readonly ariaHidden?: boolean;
  readonly keyPrefix?: string;
}) {
  return (
    <div
      aria-hidden={ariaHidden || undefined}
      className="flex shrink-0 gap-4 pr-4"
    >
      {examples.map((example) => (
        <EmployeeCard
          example={example}
          key={`${keyPrefix}${example.slug}`}
        />
      ))}
    </div>
  );
}

export function JobsSection({
  onGetStarted,
}: {
  readonly onGetStarted: () => void;
}) {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <section className="py-16 sm:py-24" id="jobs">
      <MarketingContainer>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className={marketingType.sectionTitle}>Give Pearl employees</h2>
          <p className={`mt-4 ${marketingType.body}`}>
            Define specialists that Pearl can delegate to for specific jobs.
          </p>
        </div>
      </MarketingContainer>

      <div className="relative mt-10 sm:mt-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent sm:w-20 md:w-28"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent sm:w-20 md:w-28"
        />

        {reduceMotion ? (
          <div
            aria-label="Pearl employees"
            className="flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:px-8 [&::-webkit-scrollbar]:hidden"
          >
            {MARKETPLACE_EXAMPLES.map((example) => (
              <EmployeeCard example={example} key={example.slug} />
            ))}
          </div>
        ) : (
          <div aria-label="Pearl employees" className="group overflow-hidden">
            <div className="pearl-jobs-ticker flex w-max">
              <TickerTrack examples={MARKETPLACE_EXAMPLES} />
              <TickerTrack
                ariaHidden
                examples={MARKETPLACE_EXAMPLES}
                keyPrefix="dup-"
              />
            </div>
          </div>
        )}
      </div>

      <MarketingContainer className="mt-10 flex flex-wrap items-center justify-center gap-2 sm:mt-12 sm:gap-3">
        <Button asChild className="rounded-full">
          <Link href="/marketplace">Explore templates</Link>
        </Button>
        <Button
          className="rounded-full"
          onClick={onGetStarted}
          type="button"
          variant="outline"
        >
          Create your own
        </Button>
      </MarketingContainer>
    </section>
  );
}
