"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  AgentsDemo,
  ApprovalsDemo,
  MemoryDemo,
  RoutinesDemo,
  SkillsDemo,
} from "@/components/marketing/feature-demos";
import { MarketingContainer } from "@/components/marketing/section";
import { marketingType } from "@/components/marketing/type";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    title: "Skills",
    body: "Teach Pearl a workflow once. It can reuse the steps later.",
    Demo: SkillsDemo,
  },
  {
    title: "Remembers",
    body: "Pearl keeps context about you over time so work doesn’t start from zero.",
    Demo: MemoryDemo,
  },
  {
    title: "Routines",
    body: "Custom agents can run on a schedule for the jobs you assign.",
    Demo: RoutinesDemo,
  },
  {
    title: "Hands off work",
    body: "Spin up specialized agents and let them handle ongoing tasks.",
    Demo: AgentsDemo,
  },
  {
    title: "Approvals",
    body: "Sensitive actions wait for you — send, deploy, merge, and more.",
    Demo: ApprovalsDemo,
  },
] as const satisfies ReadonlyArray<{
  readonly title: string;
  readonly body: string;
  readonly Demo: ComponentType;
}>;

const SCROLL_STEP = 304;

export function FeaturesSection() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;

    const update = () => {
      const max = node.scrollWidth - node.clientWidth;
      setCanPrev(node.scrollLeft > 4);
      setCanNext(node.scrollLeft < max - 4);
    };

    update();
    node.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      node.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  const scrollByDir = (dir: -1 | 1) => {
    scrollerRef.current?.scrollBy({
      left: dir * SCROLL_STEP,
      behavior: "smooth",
    });
  };

  return (
    <section className="py-16 sm:py-24" id="features">
      <MarketingContainer>
        <div className="max-w-2xl">
          <h2 className={marketingType.sectionTitle}>More than just search.</h2>
          <p className={`mt-4 ${marketingType.body}`}>
            Connections, memory, routines, and approvals around the conversation.
          </p>
        </div>
      </MarketingContainer>

      <div className="relative mt-10 sm:mt-12">
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-16 bg-gradient-to-r from-background to-transparent md:block",
            canPrev ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-16 bg-gradient-to-l from-background to-transparent md:block",
            canNext ? "opacity-100" : "opacity-0",
          )}
        />

        {canPrev ? (
          <Button
            aria-label="Previous features"
            className="absolute top-[112px] left-3 z-20 hidden size-10 rounded-full border-border bg-card shadow-sm md:inline-flex"
            onClick={() => scrollByDir(-1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
        ) : null}
        {canNext ? (
          <Button
            aria-label="Next features"
            className="absolute top-[112px] right-3 z-20 hidden size-10 rounded-full border-border bg-card shadow-sm md:inline-flex"
            onClick={() => scrollByDir(1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        ) : null}

        <div
          className={cn(
            "flex touch-pan-x gap-6 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            // Start flush with MarketingContainer (px-4 / lg:px-6 / xl:max-w-7xl);
            // scrolling lets cards travel past that inset to the viewport edge.
            "pl-[max(1rem,calc((100vw-80rem)/2+1.5rem))] pr-[max(1rem,calc((100vw-80rem)/2+1.5rem))]",
            "lg:pl-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))] lg:pr-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))]",
          )}
          ref={scrollerRef}
        >
          {FEATURES.map((feature) => {
            const Demo = feature.Demo;
            return (
              <article
                className="w-[min(280px,75vw)] shrink-0"
                key={feature.title}
              >
                <div className="aspect-square">
                  <Demo />
                </div>
                <h3 className="mt-5 text-base font-medium tracking-tight text-balance text-foreground sm:text-lg">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">
                  {feature.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
