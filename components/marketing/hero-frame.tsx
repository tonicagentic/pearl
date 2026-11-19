"use client";

import { motion } from "motion/react";
import { PearlIcon } from "@/components/icons";
import { EASE } from "@/components/marketing/hero-word";
import { usePrefersReducedMotion } from "@/components/marketing/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

function FrameChrome() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card text-left shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span
          aria-hidden
          className="size-2.5 rounded-full bg-[#ff5f57] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.2)]"
        />
        <span
          aria-hidden
          className="size-2.5 rounded-full bg-[#febc2e] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.2)]"
        />
        <span
          aria-hidden
          className="size-2.5 rounded-full bg-[#28c840] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.2)]"
        />
        <span className="ml-2 text-xs text-muted-foreground">Pearl</span>
      </div>

      <div className="flex min-h-[280px] flex-col gap-6 px-5 py-6 sm:min-h-[360px] sm:px-8 sm:py-8">
        <div className="space-y-4">
          <div className="flex justify-end">
            <p className="max-w-[85%] rounded-2xl bg-secondary px-4 py-2.5 text-sm leading-6 text-secondary-foreground">
              Help me turn this half-formed idea into something I can argue for.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
              <PearlIcon className="size-3.5 text-foreground" />
            </div>
            <p className="max-w-[90%] text-sm leading-6 text-foreground">
              Start with the claim in one sentence. Then name the strongest
              objection and what would have to be true for it to fail. We can
              tighten from there.
            </p>
          </div>
        </div>

        <div className="mt-auto rounded-2xl border border-border bg-background px-4 py-3">
          <p className="text-sm text-muted-foreground">Message Pearl…</p>
        </div>
      </div>
    </div>
  );
}

export function HeroFrame({
  className,
  static: isStatic = false,
}: {
  readonly className?: string;
  readonly static?: boolean;
}) {
  const reduceMotion = usePrefersReducedMotion();

  if (isStatic) {
    return (
      <div className={cn("w-full", className)}>
        <FrameChrome />
      </div>
    );
  }

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn("w-full", className)}
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 1, ease: EASE, delay: 0.8 }
      }
    >
      <FrameChrome />
    </motion.div>
  );
}
