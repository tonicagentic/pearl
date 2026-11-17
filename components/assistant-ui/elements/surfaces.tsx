"use client";

import type { ComponentProps } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export const paper = "bg-background border border-border/60 dark:bg-popover";

export const floating = "bg-background border border-border/60 dark:bg-popover";

export const field = "bg-foreground/[0.04] dark:bg-foreground/[0.06]";

export const fieldInteractive =
  "bg-foreground/[0.04] transition-colors hover:bg-foreground/[0.07] dark:bg-foreground/[0.06] dark:hover:bg-foreground/[0.09]";

export const pressable =
  "transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.96] motion-reduce:transition-none";

export const ghostButton =
  "flex items-center justify-center rounded-full text-foreground/45 outline-none transition-[background-color,color,scale] duration-150 hover:bg-foreground/[0.06] hover:text-foreground/90 active:scale-[0.96] focus-visible:ring-1 focus-visible:ring-foreground/20 motion-reduce:transition-none dark:hover:bg-foreground/[0.09]";

export const inkButton =
  "bg-foreground text-background transition-[opacity,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:opacity-90 active:scale-[0.96] motion-reduce:transition-none";

export const iconSwap =
  "[grid-area:1/1] transition-[opacity,scale,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none";

export const iconSwapIn = "scale-100 opacity-100 blur-none";

export const iconSwapOut = "scale-[0.25] opacity-0 blur-[4px]";

/**
 * transitions.dev thinking-states / text-states-swap.
 * Outgoing exits up + blur; incoming is planted below (`enter-start`, no
 * transition), then released after `--think-gap` so both halves overlap for
 * one `--think-swap` (not two sequential swaps).
 */
export const labelSwap =
  "col-start-1 row-start-1 flex w-max items-center gap-1.5 whitespace-nowrap leading-none transition-[opacity,filter,transform] duration-150 ease-in-out will-change-[transform,filter,opacity] motion-reduce:transition-none";

export const labelSwapIn = "translate-y-0 opacity-100 blur-none";

/** `--think-distance` 8px up + `--think-blur` 2px. */
export const labelSwapOut =
  "pointer-events-none -translate-y-2 select-none opacity-0 blur-[2px]";

/** Incoming rest state before release — transition disabled so it snaps below. */
export const labelSwapEnterStart =
  "pointer-events-none translate-y-2 select-none opacity-0 blur-[2px] ![transition:none]";

/** Motion tokens mirrored from mobile / transitions.dev thinking-states. */
export const THINK_SWAP_MS = 150;
export const THINK_GAP_MS = 50;
export const THINK_SWAP_Y = 8;
export const STEP_ENTER_MS = 220;
export const MESSAGE_ENTER_MS = 220;

/** Message enter: approx mobile spring FadeInDown (Y≈14). */
export const messageEnter =
  "fade-in slide-in-from-bottom-[14px] animate-in fill-mode-both duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none";

/** Timeline / thinking step enter: mobile STEP_ENTER (Y≈6, 220ms). */
export const stepEnter =
  "fade-in slide-in-from-bottom-[6px] animate-in fill-mode-both duration-[220ms] ease-out motion-reduce:animate-none";

/** Thinking label swap enter (after --think-gap). */
export const thinkSwapEnter =
  "fade-in slide-in-from-bottom-[8px] animate-in fill-mode-both duration-[150ms] ease-in-out delay-[50ms] motion-reduce:animate-none motion-reduce:delay-0";

/** Thinking label swap exit: float up + blur + fade. */
export const thinkSwapExit =
  "animate-out fade-out slide-out-to-top-[8px] fill-mode-both duration-[150ms] ease-in-out blur-[2px] motion-reduce:animate-none";

export const collapsePanel =
  "h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] data-[ending-style]:h-0 data-[starting-style]:h-0 motion-reduce:transition-none";

export const live = "text-blue-500 dark:text-blue-400";

export const mono = "font-mono text-[11px] tracking-tight";

/** Shared thread type scale: body and meta stay the same size. */
export const threadText = "text-[15px] leading-6";

/** Thinking, tool, and timeline chrome — same size as body, quieter color. */
export const threadMeta = `${threadText} text-muted-foreground`;

export const threadDiffAdd = "text-emerald-600 dark:text-emerald-400";
export const threadDiffRemove = "text-red-600 dark:text-red-400";

export function ShimmerLabel({
  active = true,
  className,
  children,
  ...props
}: ComponentProps<"span"> & { active?: boolean }) {
  const label =
    typeof children === "string" || typeof children === "number"
      ? String(children)
      : undefined;
  return (
    <span
      className={cn(active && "t-shimmer", className)}
      data-text={active ? label : undefined}
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * Scroll region for content that keeps its own whitespace. `whitespace-pre` in
 * a bounded box clips a long line with no way to reach it, so the rows scroll
 * instead.
 *
 * `codeSurface` wraps all the rows as one block, and the rows are its children.
 * It cannot go on each row: `min-width: 100%` resolves against the scroll
 * container's visible width rather than its scroll width, so a per-row width
 * leaves every row except the longest ending its background at the fold.
 */
export const codeScroll = "overflow-x-auto";

export const codeSurface = "w-max min-w-full";

export function SwapLabel({
  active,
  children,
  className,
}: {
  active: 0 | 1;
  children: [React.ReactNode, React.ReactNode];
  className?: string;
}) {
  const layers = [useRef<HTMLSpanElement>(null), useRef<HTMLSpanElement>(null)];
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const target = layers[active]?.current;
    if (!target) return undefined;
    const measure = () =>
      setWidth(Math.ceil(target.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    return () => observer.disconnect();
  }, [active]);

  return (
    <span
      style={width === null ? undefined : { width }}
      className={cn(
        "grid overflow-x-clip transition-[width] duration-150 ease-in-out motion-reduce:transition-none",
        className,
      )}
    >
      {children.map((layer, index) => (
        <span
          key={index}
          ref={layers[index]}
          aria-hidden={active !== index}
          className={cn(
            labelSwap,
            active === index ? labelSwapIn : labelSwapOut,
          )}
        >
          {layer}
        </span>
      ))}
    </span>
  );
}

type ThinkSlotPhase = "in" | "exit" | "enter-start";

function thinkSlotClass(phase: ThinkSlotPhase): string {
  if (phase === "in") return labelSwapIn;
  if (phase === "enter-start") return labelSwapEnterStart;
  return labelSwapOut;
}

/**
 * Dynamic string swapper matching transitions.dev thinking-states:
 * outgoing exits up + blur immediately; incoming snaps below (enter-start),
 * then after `--think-gap` rises + unblurs with shimmer. Width eases over
 * `--think-swap` so neighboring chrome glides with the line.
 */
export function ThinkingStatesLabel({
  label,
  shimmer = true,
  className,
}: {
  label: string;
  shimmer?: boolean;
  className?: string;
}) {
  const slotA = useRef<HTMLSpanElement>(null);
  const slotB = useRef<HTMLSpanElement>(null);
  const sizerRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState<0 | 1>(0);
  const activeRef = useRef<0 | 1>(0);
  const [slots, setSlots] = useState<[string, string]>([label, label]);
  // First paint uses the same enter path as a mid-turn swap (plant below,
  // then rise after --think-gap) so model.requested → Planning next moves
  // doesn't pop in cold.
  const [phases, setPhases] = useState<[ThinkSlotPhase, ThinkSlotPhase]>([
    "enter-start",
    "exit",
  ]);
  const currentRef = useRef(label);
  const [width, setWidth] = useState<number | null>(null);
  // Grow snaps so streaming chips ("Searching pearl…") never clip mid-glyph
  // behind the width ease; shrink still transitions.
  const [widthTransit, setWidthTransit] = useState(false);
  const widthRef = useRef<number | null>(null);
  const gapTimer = useRef<number | null>(null);

  useLayoutEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      setPhases(["in", "exit"]);
      return;
    }

    // Release the planted first label after --think-gap. A label change that
    // lands first clears this timer and owns the swap instead.
    gapTimer.current = window.setTimeout(() => {
      setPhases((prev) => {
        if (prev[0] !== "enter-start") return prev;
        return ["in", "exit"];
      });
      gapTimer.current = null;
    }, THINK_GAP_MS);

    return () => {
      if (gapTimer.current !== null) {
        window.clearTimeout(gapTimer.current);
        gapTimer.current = null;
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (label === currentRef.current) return;
    const previous = currentRef.current;
    currentRef.current = label;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (gapTimer.current !== null) {
      window.clearTimeout(gapTimer.current);
      gapTimer.current = null;
    }

    if (reduced) {
      setSlots([label, label]);
      setPhases(["in", "exit"]);
      activeRef.current = 0;
      setActive(0);
      return;
    }

    // Streaming tool chips grow in place ("Searching p" → "Searching pearl");
    // swapping every glyph clipped the line behind the width ease.
    const streamingRefine =
      label.startsWith(previous) || previous.startsWith(label);
    if (streamingRefine) {
      const slot = activeRef.current;
      setSlots((prev) => {
        const copy: [string, string] = [prev[0], prev[1]];
        copy[slot] = label;
        return copy;
      });
      return;
    }

    const from = activeRef.current;
    const next: 0 | 1 = from === 0 ? 1 : 0;
    setSlots((prev) => {
      const copy: [string, string] = [prev[0], prev[1]];
      copy[next] = label;
      return copy;
    });
    // Exit outgoing immediately; plant incoming below with transition:none.
    setPhases((prev) => {
      const copy: [ThinkSlotPhase, ThinkSlotPhase] = [prev[0], prev[1]];
      copy[from] = "exit";
      copy[next] = "enter-start";
      return copy;
    });
    // After --think-gap, release incoming so it rises over --think-swap.
    gapTimer.current = window.setTimeout(() => {
      setPhases((prev) => {
        const copy: [ThinkSlotPhase, ThinkSlotPhase] = [prev[0], prev[1]];
        copy[next] = "in";
        return copy;
      });
      activeRef.current = next;
      setActive(next);
      gapTimer.current = null;
    }, THINK_GAP_MS);

    return () => {
      if (gapTimer.current !== null) {
        window.clearTimeout(gapTimer.current);
        gapTimer.current = null;
      }
    };
  }, [label]);

  useLayoutEffect(() => {
    const sizer = sizerRef.current;
    if (!sizer) return undefined;
    const measure = () => {
      // Size from an unconstrained sizer holding the live label — measuring
      // clipped swap layers locked streaming chips at the first short width.
      const next = Math.ceil(sizer.getBoundingClientRect().width);
      if (next <= 0) return;
      const prev = widthRef.current;
      widthRef.current = next;
      // Only ease when the line gets shorter (swap to a briefer status).
      setWidthTransit(prev !== null && next < prev);
      setWidth(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(sizer);
    return () => observer.disconnect();
  }, [label]);

  return (
    <span className={cn("relative inline-block", className)}>
      <span
        ref={sizerRef}
        aria-hidden
        className="invisible pointer-events-none absolute top-0 left-0 whitespace-nowrap"
      >
        {label}
      </span>
      <span
        style={width === null ? undefined : { width }}
        className={cn(
          "grid overflow-x-clip motion-reduce:transition-none",
          widthTransit && "transition-[width] duration-150 ease-in-out",
        )}
      >
        <span
          ref={slotA}
          aria-hidden={active !== 0}
          className={cn(labelSwap, thinkSlotClass(phases[0]))}
        >
          <ShimmerLabel active={shimmer && phases[0] !== "enter-start"}>
            {slots[0]}
          </ShimmerLabel>
        </span>
        <span
          ref={slotB}
          aria-hidden={active !== 1}
          className={cn(labelSwap, thinkSlotClass(phases[1]))}
        >
          <ShimmerLabel active={shimmer && phases[1] !== "enter-start"}>
            {slots[1]}
          </ShimmerLabel>
        </span>
      </span>
    </span>
  );
}
