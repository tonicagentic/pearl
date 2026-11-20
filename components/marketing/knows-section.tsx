"use client";

import { motion } from "motion/react";
import { MarketingSection } from "@/components/marketing/section";
import { marketingType } from "@/components/marketing/type";
import { usePrefersReducedMotion } from "@/components/marketing/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

const MEMORY_CHIPS = [
  { label: "Prefers short answers", kind: "pref" },
  { label: "Ship personal site redesign", kind: "goal" },
  { label: "LA mornings first", kind: "pref" },
  { label: "Never send without ask", kind: "pref" },
  { label: "Weekly writing habit", kind: "idea" },
] as const;

const COLUMNS = [
  {
    title: "Learns who you are",
    body: "Pearl picks up your goals, preferences, and how you like things done from conversation, so work doesn’t start from zero.",
  },
  {
    title: "Keeps your goals moving",
    body: "Helps you stay on top of tasks and projects, and turns long-term goals into real progress.",
  },
  {
    title: "Comes back ready to act",
    body: "Reflects on what matters, suggests ideas built around what you need, and acts under your direction.",
  },
] as const;

function KnowsVisual() {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <div
      aria-hidden
      className="mx-auto mt-10 w-full max-w-md sm:mt-12"
    >
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-none">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="size-2.5 rounded-full bg-muted-foreground/25" />
          <span className="size-2.5 rounded-full bg-muted-foreground/25" />
          <span className="size-2.5 rounded-full bg-muted-foreground/25" />
          <span className="ml-2 text-xs text-muted-foreground">About you</span>
        </div>
        <div className="relative flex min-h-[220px] flex-col justify-center gap-2 bg-muted/40 px-5 py-6 sm:px-6">
          {MEMORY_CHIPS.map((chip, index) => (
            <motion.div
              animate={
                reduceMotion
                  ? { opacity: 1, y: 0 }
                  : { opacity: [0, 1, 1, 0.85], y: [8, 0, 0, 0] }
              }
              className={cn(
                "w-fit max-w-full rounded-lg border border-border bg-card px-3 py-2 text-xs leading-snug text-foreground shadow-sm",
                chip.kind === "goal" && "self-end",
                chip.kind === "idea" && "self-center",
              )}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              key={chip.label}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      duration: 4.5,
                      times: [0, 0.12, 0.8, 1],
                      delay: index * 0.2,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "easeInOut",
                    }
              }
            >
              {chip.label}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function KnowsSection() {
  return (
    <MarketingSection id="knows">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className={marketingType.sectionTitle}>
          Pearl learns about you, your goals, and how you like things done.
        </h2>
      </div>

      <KnowsVisual />

      <ul className="mt-12 grid gap-8 sm:grid-cols-3 sm:gap-6 lg:gap-10">
        {COLUMNS.map((column) => (
          <li key={column.title}>
            <h3 className="text-base font-medium tracking-tight">
              {column.title}
            </h3>
            <p className={`mt-2 ${marketingType.caption}`}>{column.body}</p>
          </li>
        ))}
      </ul>
    </MarketingSection>
  );
}
