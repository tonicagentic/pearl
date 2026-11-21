"use client";

import { AnimatePresence, motion } from "motion/react";
import { CheckIcon, PauseIcon, PlayIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PearlIcon } from "@/components/icons";
import {
  ASK_EXAMPLES,
  type AskSlide,
  type AskTask,
} from "@/components/marketing/ask-examples";
import { EASE } from "@/components/marketing/hero-word";
import { MarketingJsonCard } from "@/components/marketing/marketing-json-card";
import { useAskExampleLoop } from "@/components/marketing/use-ask-example-loop";
import { usePrefersReducedMotion } from "@/components/marketing/use-prefers-reduced-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const HERO_COVER_SRC = "/marketing/hero-cover.jpg";

/** Cover plate — theme radius + border. */
const HERO_SHELL = "overflow-hidden rounded-lg border border-border";

const FLOAT_SHADOW =
  "shadow-[0_28px_90px_-28px_rgba(0,0,0,0.45)]";

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

function PromptPill({ text }: { readonly text: string }) {
  return (
    <p className="mx-auto max-w-md rounded-2xl border border-border bg-card px-4 py-3 text-center text-sm leading-snug text-foreground shadow-sm">
      {text}
    </p>
  );
}

function TaskRow({ task }: { readonly task: AskTask }) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-full border border-border bg-card px-3.5 py-2.5",
        FLOAT_SHADOW,
      )}
    >
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-background"
      >
        <CheckIcon className="size-3.5" strokeWidth={2.5} />
      </span>
      <span className="inline-flex shrink-0 rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
        {task.verb}
      </span>
      <span className="min-w-0 text-sm leading-snug text-muted-foreground">
        {task.rest}
      </span>
    </li>
  );
}

function TasksSlide({ slide }: { readonly slide: Extract<AskSlide, { kind: "tasks" }> }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-stretch gap-4">
      <ul className="flex flex-col gap-2.5">
        {slide.tasks.map((task) => (
          <TaskRow key={task.verb + task.rest} task={task} />
        ))}
      </ul>
      <PromptPill text={slide.prompt} />
    </div>
  );
}

function CardSlide({ slide }: { readonly slide: Extract<AskSlide, { kind: "card" }> }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4">
      <PromptPill text={slide.prompt} />
      <div
        className={cn(
          "w-full space-y-3 overflow-hidden rounded-2xl border border-border bg-card p-3 sm:p-4",
          FLOAT_SHADOW,
        )}
      >
        {slide.cards.map((spec, i) => (
          <MarketingJsonCard key={`${slide.slug}-card-${i}`} spec={spec} />
        ))}
      </div>
      <p className="max-w-md text-center text-sm leading-snug text-white/90 drop-shadow-sm">
        {slide.outcome}
      </p>
    </div>
  );
}

function HeroSlide({
  slide,
  reduceMotion,
}: {
  readonly slide: AskSlide;
  readonly reduceMotion: boolean;
}) {
  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        aria-labelledby={`hero-ask-tab-${slide.slug}`}
        className="flex size-full items-center justify-center overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
        id="hero-ask-panel"
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        key={slide.slug}
        role="tabpanel"
        transition={{ duration: reduceMotion ? 0 : 0.28 }}
      >
        {slide.kind === "tasks" ? (
          <TasksSlide slide={slide} />
        ) : (
          <CardSlide slide={slide} />
        )}
      </motion.div>
    </AnimatePresence>
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
    <div
      className={cn(
        `relative aspect-[4/5] w-full sm:aspect-[3/2] ${HERO_SHELL}`,
        className,
      )}
    >
      <div aria-hidden className="absolute inset-0">
        <img
          alt=""
          className="size-full object-cover"
          decoding="async"
          src={HERO_COVER_SRC}
        />
      </div>
      <PearlIcon className="pointer-events-none absolute top-4 left-4 z-20 size-8 text-white drop-shadow-sm sm:top-5 sm:left-5 sm:size-9" />
      <div className="absolute inset-0 z-10 p-[1.25em] sm:p-[2em]">{children}</div>
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

  return (
    <div className={cn("w-full", className)} {...pauseBind}>
      <HeroStage>
        <HeroSlide reduceMotion={reduceMotion} slide={active} />
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
