"use client";

import { AnimatePresence, motion } from "motion/react";
import { PlusIcon, SearchIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AgentAccentMark } from "@/components/custom-agents/agent-identity-pill";
import { PearlIcon } from "@/components/icons";
import {
  ASK_EXAMPLES,
  type AskExample,
} from "@/components/marketing/ask-examples";
import { EASE } from "@/components/marketing/hero-word";
import { MarketingJsonCard } from "@/components/marketing/marketing-json-card";
import { MARKETPLACE_EXAMPLES } from "@/components/marketing/marketplace-examples";
import { useAskExampleLoop } from "@/components/marketing/use-ask-example-loop";
import { usePrefersReducedMotion } from "@/components/marketing/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

const HERO_COVER_SRC = "/marketing/hero-cover.jpg";

/** Cover plate — theme radius + border. */
const HERO_SHELL = "overflow-hidden rounded-lg border border-border";

/** App window — closer to the reference’s softer chrome. */
const APP_SHELL =
  "overflow-hidden rounded-2xl border border-border bg-card text-left shadow-[0_28px_90px_-28px_rgba(0,0,0,0.45)]";

const SIDEBAR_AGENTS = MARKETPLACE_EXAMPLES.slice(0, 3);

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

function firstUserPreview(example: AskExample): string {
  const first = example.messages.find((message) => message.role === "user");
  return first?.text ?? "";
}

function ExampleTabs({
  index,
  onSelect,
  panelId,
  tabIdPrefix,
  compact = false,
}: {
  readonly index: number;
  readonly onSelect: (next: number) => void;
  readonly panelId: string;
  readonly tabIdPrefix: string;
  readonly compact?: boolean;
}) {
  return (
    <div
      aria-label="Ask Pearl examples"
      className={cn(
        "flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        compact ? "px-2 pb-2" : "px-3 pb-2.5",
      )}
      role="tablist"
    >
      {ASK_EXAMPLES.map((example, i) => {
        const selected = i === index;
        return (
          <button
            aria-controls={panelId}
            aria-selected={selected}
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center rounded-full border font-medium whitespace-nowrap transition-colors",
              compact
                ? "h-6 px-2 text-[10px]"
                : "h-7 px-2.5 text-[11px]",
              selected
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
            id={`${tabIdPrefix}-${example.slug}`}
            key={example.slug}
            onClick={() => onSelect(i)}
            role="tab"
            type="button"
          >
            {example.tab}
          </button>
        );
      })}
    </div>
  );
}

function AskChatMessages({
  example,
  compact = false,
  reduceMotion,
}: {
  readonly example: AskExample;
  readonly compact?: boolean;
  readonly reduceMotion: boolean;
}) {
  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className={cn("space-y-3", compact ? "px-3 py-3" : "px-5 py-4")}
        exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
        initial={reduceMotion ? false : { opacity: 0, y: 4 }}
        key={example.slug}
        transition={{ duration: reduceMotion ? 0 : 0.22 }}
      >
        {example.messages.map((message, messageIndex) =>
          message.role === "user" ? (
            <div
              className="flex justify-end"
              key={`${example.slug}-u-${messageIndex}`}
            >
              <p
                className={cn(
                  "rounded-2xl bg-foreground text-background",
                  compact
                    ? "max-w-[90%] px-3 py-2 text-[11px] leading-4"
                    : "max-w-[85%] px-3.5 py-2.5 text-sm leading-5",
                )}
              >
                {message.text}
              </p>
            </div>
          ) : (
            <div
              className="flex items-start gap-2.5"
              key={`${example.slug}-a-${messageIndex}`}
            >
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
              <div
                className={cn(
                  "flex min-w-0 flex-col gap-2.5",
                  compact ? "max-w-[90%]" : "max-w-[90%]",
                )}
              >
                <p
                  className={cn(
                    "rounded-2xl bg-secondary text-secondary-foreground",
                    compact
                      ? "px-3 py-2 text-[11px] leading-4"
                      : "px-3.5 py-2.5 text-sm leading-5",
                  )}
                >
                  {message.text}
                </p>
                {message.spec ? (
                  <MarketingJsonCard spec={message.spec} />
                ) : null}
              </div>
            </div>
          ),
        )}
      </motion.div>
    </AnimatePresence>
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

type AskWindowProps = Pick<
  ReturnType<typeof useAskExampleLoop>,
  "index" | "active" | "reduceMotion" | "select"
>;

/** Desktop Pearl window — locked 3:2 like the reference app mock. */
function DesktopAppWindow({
  index,
  active,
  reduceMotion,
  select,
}: AskWindowProps) {
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
          {SIDEBAR_AGENTS.map((agent, agentIndex) => (
            <div
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-1 py-2",
                agentIndex === 0 ? "bg-card shadow-sm" : "opacity-80",
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

        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ASK_EXAMPLES.map((example, exampleIndex) => (
            <button
              className={cn(
                "w-full rounded-lg px-2.5 py-2 text-left transition-colors",
                exampleIndex === index
                  ? "bg-card"
                  : "hover:bg-card/60",
              )}
              key={example.slug}
              onClick={() => select(exampleIndex)}
              type="button"
            >
              <p className="truncate text-[11px] font-medium text-foreground">
                {example.tab}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                {firstUserPreview(example)}
              </p>
            </button>
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
        <div className="flex flex-col border-b border-border">
          <div className="flex items-center justify-center px-4 pt-2.5 pb-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1">
              <PearlIcon className="size-3 text-foreground" />
              <span className="text-[11px] font-medium text-foreground">
                Pearl
              </span>
            </div>
          </div>
          <ExampleTabs
            index={index}
            onSelect={select}
            panelId="hero-ask-panel-desktop"
            tabIdPrefix="hero-ask-tab-desktop"
          />
        </div>
        <div
          aria-labelledby={`hero-ask-tab-desktop-${active.slug}`}
          className="min-h-0 flex-1 overflow-y-auto"
          id="hero-ask-panel-desktop"
          role="tabpanel"
        >
          <AskChatMessages
            example={active}
            reduceMotion={reduceMotion}
          />
        </div>
        <Composer />
      </div>
    </div>
  );
}

/** Phone frame for small screens — portrait chat, no desktop sidebar. */
function MobileAppWindow({
  index,
  active,
  reduceMotion,
  select,
}: AskWindowProps) {
  return (
    <div
      className={cn(
        APP_SHELL,
        "mx-auto flex aspect-[9/19.5] w-[min(272px,72vw)] flex-col rounded-[1.75rem]",
      )}
    >
      <div className="relative flex flex-col border-b border-border">
        <div className="relative flex items-center justify-center px-3 pt-3 pb-2">
          <span
            aria-hidden
            className="absolute top-2 left-1/2 h-1.5 w-16 -translate-x-1/2 rounded-full bg-foreground/15"
          />
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1">
            <PearlIcon className="size-3 text-foreground" />
            <span className="text-[11px] font-medium text-foreground">Pearl</span>
          </div>
        </div>
        <ExampleTabs
          compact
          index={index}
          onSelect={select}
          panelId="hero-ask-panel-mobile"
          tabIdPrefix="hero-ask-tab-mobile"
        />
      </div>
      <div
        aria-labelledby={`hero-ask-tab-mobile-${active.slug}`}
        className="min-h-0 flex-1 overflow-y-auto"
        id="hero-ask-panel-mobile"
        role="tabpanel"
      >
        <AskChatMessages
          compact
          example={active}
          reduceMotion={reduceMotion}
        />
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

function AppWindows({ rotate }: { readonly rotate: boolean }) {
  const { index, active, reduceMotion, select, pauseBind } =
    useAskExampleLoop({ rotate });
  const windowProps = { index, active, reduceMotion, select };

  return (
    <div {...pauseBind}>
      <div className="hidden md:block">
        <DesktopAppWindow {...windowProps} />
      </div>
      <div className="md:hidden">
        <MobileAppWindow {...windowProps} />
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
      <HeroStage className={className}>
        <AppWindows rotate={false} />
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
        <AppWindows rotate />
      </HeroStage>
    </motion.div>
  );
}
