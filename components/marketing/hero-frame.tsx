"use client";

import { AnimatePresence, motion } from "motion/react";
import { PauseIcon, PlayIcon, PlusIcon, SearchIcon } from "lucide-react";
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
import { Button } from "@/components/ui/button";
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
  progress,
  userPlaying,
  canAutoplay,
  onSelect,
  onTogglePlaying,
}: {
  readonly index: number;
  readonly progress: number;
  readonly userPlaying: boolean;
  readonly canAutoplay: boolean;
  readonly onSelect: (next: number) => void;
  readonly onTogglePlaying: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      <div
        aria-label="Ask Pearl examples"
        className="flex min-w-0 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
      >
        {ASK_EXAMPLES.map((example, i) => {
          const selected = i === index;
          return (
            <button
              aria-controls="hero-ask-panel"
              aria-selected={selected}
              className={cn(
                "relative inline-flex h-9 shrink-0 cursor-pointer items-center overflow-hidden rounded-full border px-3 text-sm font-medium whitespace-nowrap transition-colors",
                selected
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
              id={`hero-ask-tab-${example.slug}`}
              key={example.slug}
              onClick={() => onSelect(i)}
              role="tab"
              type="button"
            >
              <span className="relative z-10">{example.tab}</span>
              {selected && canAutoplay ? (
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-background/80"
                  style={{ transform: `scaleX(${progress})` }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {canAutoplay ? (
        <Button
          aria-label={userPlaying ? "Pause examples" : "Play examples"}
          className="size-9 shrink-0 rounded-full"
          onClick={onTogglePlaying}
          size="icon"
          type="button"
          variant="outline"
        >
          {userPlaying ? (
            <PauseIcon className="size-3.5" />
          ) : (
            <PlayIcon className="size-3.5" />
          )}
        </Button>
      ) : null}
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
              <div className="flex min-w-0 max-w-[90%] flex-col gap-2.5">
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
                exampleIndex === index ? "bg-card" : "hover:bg-card/60",
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
        <div className="flex items-center justify-center border-b border-border px-4 py-2.5">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1">
            <PearlIcon className="size-3 text-foreground" />
            <span className="text-[11px] font-medium text-foreground">
              Pearl
            </span>
          </div>
        </div>
        <div
          aria-labelledby={`hero-ask-tab-${active.slug}`}
          className="min-h-0 flex-1 overflow-y-auto"
          id="hero-ask-panel"
          role="tabpanel"
        >
          <AskChatMessages example={active} reduceMotion={reduceMotion} />
        </div>
        <Composer />
      </div>
    </div>
  );
}

/** Phone frame for small screens — portrait chat, no desktop sidebar. */
function MobileAppWindow({
  active,
  reduceMotion,
}: AskWindowProps) {
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
      <div
        aria-labelledby={`hero-ask-tab-${active.slug}`}
        className="min-h-0 flex-1 overflow-y-auto"
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
      <PearlIcon className="pointer-events-none absolute top-4 left-4 z-20 size-8 text-white drop-shadow-sm sm:top-5 sm:left-5 sm:size-9" />
      <div className="relative z-10 p-[2em]">{children}</div>
    </div>
  );
}

function HeroAskDemo({
  rotate,
  className,
}: {
  readonly rotate: boolean;
  readonly className?: string;
}) {
  const {
    index,
    active,
    progress,
    userPlaying,
    canAutoplay,
    reduceMotion,
    select,
    togglePlaying,
    pauseBind,
  } = useAskExampleLoop({ rotate });
  const windowProps = { index, active, reduceMotion, select };

  return (
    <div className={cn("w-full", className)} {...pauseBind}>
      <HeroStage>
        <div className="hidden md:block">
          <DesktopAppWindow {...windowProps} />
        </div>
        <div className="md:hidden">
          <MobileAppWindow {...windowProps} />
        </div>
      </HeroStage>
      <div className="mt-6 sm:mt-8">
        <ExampleTabs
          canAutoplay={canAutoplay}
          index={index}
          onSelect={select}
          onTogglePlaying={togglePlaying}
          progress={progress}
          userPlaying={userPlaying}
        />
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
    return <HeroAskDemo className={className} rotate={false} />;
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
      <HeroAskDemo rotate />
    </motion.div>
  );
}
