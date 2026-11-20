"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { AgentAccentMark } from "@/components/custom-agents/agent-identity-pill";
import { MARKETPLACE_EXAMPLES } from "@/components/marketing/marketplace-examples";
import { usePrefersReducedMotion } from "@/components/marketing/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

const researchDesk = MARKETPLACE_EXAMPLES[0];
const inboxClerk = MARKETPLACE_EXAMPLES[1];

function DemoStage({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex size-full items-center justify-center overflow-hidden rounded-xl bg-muted p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ConnectionsDemo() {
  const reduceMotion = usePrefersReducedMotion();
  const chips = [
    { label: "Gmail", x: -48, y: -36, delay: 0 },
    { label: "Calendar", x: 36, y: -28, delay: 0.35 },
    { label: "GitHub", x: -8, y: 40, delay: 0.7 },
  ] as const;

  return (
    <DemoStage>
      {chips.map((chip) => (
        <motion.span
          animate={
            reduceMotion
              ? { opacity: 1, x: chip.x, y: chip.y }
              : {
                  opacity: 1,
                  x: [chip.x, chip.x + 6, chip.x - 4, chip.x],
                  y: [chip.y, chip.y - 5, chip.y + 4, chip.y],
                }
          }
          className="absolute rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm"
          initial={reduceMotion ? false : { opacity: 0, x: 0, y: 0 }}
          key={chip.label}
          transition={
            reduceMotion
              ? { duration: 0 }
              : {
                  duration: 4.5,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                  delay: chip.delay,
                }
          }
        >
          {chip.label}
        </motion.span>
      ))}
    </DemoStage>
  );
}

export function SkillsDemo() {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <DemoStage>
      <motion.div
        animate={
          reduceMotion
            ? { opacity: 1, y: 0 }
            : { opacity: [0, 1, 1, 0], y: [12, 0, 0, -8] }
        }
        className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : {
                duration: 3.6,
                times: [0, 0.2, 0.75, 1],
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }
        }
      >
        Cite and date
      </motion.div>
    </DemoStage>
  );
}

export function MemoryDemo() {
  const reduceMotion = usePrefersReducedMotion();
  const notes = [
    "Prefers short answers",
    "LA mornings first",
    "Never send without ask",
  ] as const;

  return (
    <DemoStage className="flex-col gap-2 px-6">
      {notes.map((note, index) => (
        <motion.div
          animate={
            reduceMotion
              ? { opacity: 1, y: 0 }
              : { opacity: [0, 1, 1, 0], y: [10, 0, 0, 0] }
          }
          className="w-full max-w-[190px] rounded-lg border border-border bg-card px-3 py-2 text-xs leading-snug text-foreground shadow-sm"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          key={note}
          transition={
            reduceMotion
              ? { duration: 0 }
              : {
                  duration: 4,
                  times: [0, 0.15, 0.75, 1],
                  delay: index * 0.25,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }
          }
        >
          {note}
        </motion.div>
      ))}
    </DemoStage>
  );
}

export function RoutinesDemo() {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <DemoStage>
      <motion.div
        animate={
          reduceMotion
            ? { opacity: 1, scale: 1 }
            : { opacity: 1, scale: [1, 1.04, 1] }
        }
        className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : {
                duration: 2.4,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }
        }
      >
        Morning brief · 8:30
      </motion.div>
    </DemoStage>
  );
}

export function AgentsDemo() {
  const reduceMotion = usePrefersReducedMotion();
  const agents = [researchDesk, inboxClerk];

  return (
    <DemoStage>
      <div className="flex flex-col items-center gap-3">
        {agents.map((agent, index) => (
          <motion.div
            animate={
              reduceMotion
                ? { opacity: 1, x: 0 }
                : {
                    opacity: 1,
                    x: index === 0 ? [0, 6, 0] : [0, -6, 0],
                  }
            }
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pr-3 pl-1.5 text-xs font-medium text-foreground shadow-sm"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            key={agent.slug}
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    duration: 3.2,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                    delay: index * 0.2,
                  }
            }
          >
            <AgentAccentMark
              accent={agent.accent}
              markBrows={agent.markBrows}
              markGaze={agent.markGaze}
              markShape={agent.markShape}
              markTalk={agent.markTalk}
              motion="off"
              size="sm"
            />
            {agent.name}
          </motion.div>
        ))}
      </div>
    </DemoStage>
  );
}

export function ApprovalsDemo() {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <DemoStage>
      <div className="w-full max-w-[190px] rounded-xl border border-border bg-card p-3 shadow-sm">
        <p className="text-xs font-medium text-foreground">Send draft?</p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Reply to Alex about Thursday.
        </p>
        <div className="relative mt-3 h-8">
          <motion.div
            animate={
              reduceMotion
                ? { opacity: 1 }
                : { opacity: [1, 1, 0, 0, 1] }
            }
            className="absolute inset-0 flex items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    duration: 3.2,
                    times: [0, 0.4, 0.5, 0.85, 1],
                    repeat: Number.POSITIVE_INFINITY,
                  }
            }
          >
            Approve
          </motion.div>
          <motion.div
            animate={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: [0, 0, 1, 1, 0] }
            }
            className="absolute inset-0 flex items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground"
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    duration: 3.2,
                    times: [0, 0.4, 0.5, 0.85, 1],
                    repeat: Number.POSITIVE_INFINITY,
                  }
            }
          >
            Approved
          </motion.div>
        </div>
      </div>
    </DemoStage>
  );
}
