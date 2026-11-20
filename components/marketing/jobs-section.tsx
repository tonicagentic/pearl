"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { AgentAccentMark } from "@/components/custom-agents/agent-identity-pill";
import { MARKETPLACE_EXAMPLES } from "@/components/marketing/marketplace-examples";
import { MarketingSection } from "@/components/marketing/section";
import { marketingType } from "@/components/marketing/type";
import { usePrefersReducedMotion } from "@/components/marketing/use-prefers-reduced-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ROTATE_MS = 5000;
const RESUME_IDLE_MS = 8000;

export function JobsSection({
  onGetStarted,
}: {
  readonly onGetStarted: () => void;
}) {
  const reduceMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [manualPaused, setManualPaused] = useState(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = MARKETPLACE_EXAMPLES[index] ?? MARKETPLACE_EXAMPLES[0];
  const paused = hoverPaused || focusPaused || manualPaused;

  useEffect(() => {
    return () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (reduceMotion || paused) return;
    const id = setInterval(() => {
      setIndex((current) => (current + 1) % MARKETPLACE_EXAMPLES.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [paused, reduceMotion]);

  const pauseForInteraction = () => {
    setManualPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      resumeTimer.current = null;
      setManualPaused(false);
    }, RESUME_IDLE_MS);
  };

  const select = (next: number) => {
    setIndex(next);
    pauseForInteraction();
  };

  return (
    <MarketingSection id="jobs">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className={marketingType.sectionTitle}>Give Pearl a job</h2>
        <p className={`mt-4 ${marketingType.body}`}>
          Start with a role. Make it yours.
        </p>
      </div>

      <div
        className="mt-12 sm:mt-16"
        onBlur={(event) => {
          if (
            !event.currentTarget.contains(event.relatedTarget as Node | null)
          ) {
            setFocusPaused(false);
          }
        }}
        onFocus={() => setFocusPaused(true)}
        onMouseEnter={() => setHoverPaused(true)}
        onMouseLeave={() => setHoverPaused(false)}
      >
        <div
          aria-label="Marketplace roles"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
          role="tablist"
        >
          {MARKETPLACE_EXAMPLES.map((example, i) => {
            const selected = i === index;
            return (
              <button
                aria-controls="jobs-marketplace-panel"
                aria-selected={selected}
                className={cn(
                  "inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border pr-3 pl-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
                id={`jobs-marketplace-tab-${example.slug}`}
                key={example.slug}
                onClick={() => select(i)}
                role="tab"
                type="button"
              >
                <AgentAccentMark
                  accent={example.accent}
                  markBrows={example.markBrows}
                  markGaze={example.markGaze}
                  markShape={example.markShape}
                  markTalk={example.markTalk}
                  motion="off"
                  size="sm"
                />
                {example.name}
              </button>
            );
          })}
        </div>

        <div
          aria-labelledby={`jobs-marketplace-tab-${active.slug}`}
          className="mx-auto mt-10 max-w-2xl text-center"
          id="jobs-marketplace-panel"
          role="tabpanel"
        >
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              key={active.slug}
              transition={{ duration: reduceMotion ? 0 : 0.25 }}
            >
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {active.category}
              </p>
              <p className="mt-2 text-xl font-medium tracking-tight text-foreground sm:text-2xl">
                {active.name}
              </p>
              <p className={`mt-4 ${marketingType.body}`}>{active.description}</p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex justify-center">
            <Button
              className="rounded-full"
              onClick={onGetStarted}
              type="button"
            >
              Get started
            </Button>
          </div>
        </div>
      </div>
    </MarketingSection>
  );
}
