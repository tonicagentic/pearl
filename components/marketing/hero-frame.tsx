"use client";

import { PlusIcon, SearchIcon } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { AgentAccentMark } from "@/components/custom-agents/agent-identity-pill";
import { PearlIcon } from "@/components/icons";
import { MARKETPLACE_EXAMPLES } from "@/components/marketing/marketplace-examples";
import { EASE } from "@/components/marketing/hero-word";
import { usePrefersReducedMotion } from "@/components/marketing/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

const HERO_COVER_SRC = "/marketing/hero-cover.jpg";

/** Cover plate — theme radius + border. */
const HERO_SHELL = "overflow-hidden rounded-lg border border-border";

/** App window — closer to the reference’s softer chrome. */
const APP_SHELL =
  "overflow-hidden rounded-2xl border border-border bg-card text-left shadow-[0_28px_90px_-28px_rgba(0,0,0,0.45)]";

const SIDEBAR_AGENTS = MARKETPLACE_EXAMPLES.slice(0, 3);
const SIDEBAR_THREADS = [
  { title: "Clarify the launch claim", preview: "Start with one sentence…" },
  { title: "Inbox triage", preview: "Three threads need a reply." },
  { title: "Thursday schedule", preview: "Two opens after 2pm." },
] as const;

function TrafficLights() {
  return (
    <div className="flex items-center gap-1.5">
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
    </div>
  );
}

function ChatMessages({ compact = false }: { readonly compact?: boolean }) {
  return (
    <div className={cn("space-y-3", compact ? "px-3 py-3" : "px-5 py-4")}>
      <div className="flex justify-end">
        <p
          className={cn(
            "rounded-2xl bg-foreground text-background",
            compact
              ? "max-w-[90%] px-3 py-2 text-[11px] leading-4"
              : "max-w-[85%] px-3.5 py-2.5 text-sm leading-5",
          )}
        >
          Help me turn this half-formed idea into something I can argue for.
        </p>
      </div>
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "mt-0.5 flex shrink-0 items-center justify-center rounded-full border border-border bg-muted",
            compact ? "size-6" : "size-7",
          )}
        >
          <PearlIcon
            className={cn(
              "text-foreground",
              compact ? "size-3" : "size-3.5",
            )}
          />
        </div>
        <p
          className={cn(
            "rounded-2xl bg-secondary text-secondary-foreground",
            compact
              ? "max-w-[90%] px-3 py-2 text-[11px] leading-4"
              : "max-w-[90%] px-3.5 py-2.5 text-sm leading-5",
          )}
        >
          Start with the claim in one sentence. Then name the strongest
          objection and what would have to be true for it to fail.
        </p>
      </div>
    </div>
  );
}

function Composer({ compact = false }: { readonly compact?: boolean }) {
  return (
    <div
      className={cn(
        "border-t border-border",
        compact ? "px-3 py-2.5" : "px-4 py-3",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-full border border-border bg-muted/60",
          compact ? "px-3 py-2" : "px-3.5 py-2.5",
        )}
      >
        <PlusIcon
          aria-hidden
          className={cn(
            "shrink-0 text-muted-foreground",
            compact ? "size-3.5" : "size-4",
          )}
        />
        <p
          className={cn(
            "min-w-0 flex-1 text-muted-foreground",
            compact ? "text-[11px]" : "text-sm",
          )}
        >
          Message Pearl…
        </p>
      </div>
    </div>
  );
}

/** Desktop Pearl window — locked 3:2 like the reference app mock. */
function DesktopAppWindow() {
  return (
    <div className={cn(APP_SHELL, "flex aspect-[3/2] w-full")}>
      <aside className="flex w-[30%] min-w-0 flex-col border-r border-border bg-muted/40">
        <div className="flex items-center justify-between px-3 py-3">
          <TrafficLights />
          <div className="flex items-center gap-1">
            <span className="flex size-6 items-center justify-center rounded-full text-muted-foreground">
              <SearchIcon aria-hidden className="size-3.5" />
            </span>
            <span className="flex size-6 items-center justify-center rounded-full text-muted-foreground">
              <PlusIcon aria-hidden className="size-3.5" />
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 px-2.5 pb-3">
          {SIDEBAR_AGENTS.map((agent, index) => (
            <div
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-1 py-2",
                index === 0 ? "bg-card shadow-sm" : "opacity-80",
              )}
              key={agent.slug}
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
              <span className="line-clamp-1 text-center text-[9px] font-medium tracking-tight text-foreground">
                {agent.name.split(" ")[0]}
              </span>
            </div>
          ))}
        </div>

        <div className="min-h-0 flex-1 space-y-0.5 overflow-hidden px-2 pb-2">
          {SIDEBAR_THREADS.map((thread, index) => (
            <div
              className={cn(
                "rounded-lg px-2.5 py-2",
                index === 0 ? "bg-card" : null,
              )}
              key={thread.title}
            >
              <p className="truncate text-[11px] font-medium text-foreground">
                {thread.title}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                {thread.preview}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-auto flex items-center gap-2 border-t border-border px-3 py-2.5">
          <div className="flex size-6 items-center justify-center rounded-full border border-border bg-card">
            <PearlIcon className="size-3 text-foreground" />
          </div>
          <span className="truncate text-[11px] font-medium text-foreground">
            Pearl
          </span>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-center border-b border-border px-4 py-2.5">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1">
            <PearlIcon className="size-3 text-foreground" />
            <span className="text-[11px] font-medium text-foreground">
              Pearl
            </span>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <ChatMessages />
        </div>
        <Composer />
      </div>
    </div>
  );
}

/** Phone frame for small screens — portrait chat, no desktop sidebar. */
function MobileAppWindow() {
  return (
    <div
      className={cn(
        APP_SHELL,
        "mx-auto flex aspect-[9/19.5] w-[min(272px,72vw)] flex-col rounded-[1.75rem]",
      )}
    >
      <div className="relative flex items-center justify-center border-b border-border px-3 py-3">
        <span
          aria-hidden
          className="absolute top-2 left-1/2 h-1.5 w-16 -translate-x-1/2 rounded-full bg-foreground/15"
        />
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1">
          <PearlIcon className="size-3 text-foreground" />
          <span className="text-[11px] font-medium text-foreground">Pearl</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <ChatMessages compact />
      </div>
      <Composer compact />
    </div>
  );
}

function HeroStage({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={cn(`relative w-full ${HERO_SHELL}`, className)}>
      <div aria-hidden className="absolute inset-0">
        <img
          alt=""
          className="size-full object-cover"
          decoding="async"
          src={HERO_COVER_SRC}
        />
      </div>
      <div className="relative z-10 p-[2em]">{children}</div>
    </div>
  );
}

function AppWindows() {
  return (
    <>
      <div className="hidden md:block">
        <DesktopAppWindow />
      </div>
      <div className="md:hidden">
        <MobileAppWindow />
      </div>
    </>
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
      <HeroStage className={className}>
        <AppWindows />
      </HeroStage>
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
      <HeroStage>
        <AppWindows />
      </HeroStage>
    </motion.div>
  );
}
