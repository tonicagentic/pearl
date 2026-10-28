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

/** Match thinking-states (~150ms) opacity + blur swap. */
export const labelSwap =
  "col-start-1 row-start-1 flex w-max items-center gap-1.5 leading-none transition-[opacity,filter,transform] duration-150 ease-in-out motion-reduce:transition-none";

export const labelSwapIn = "translate-y-0 opacity-100 blur-none";

export const labelSwapOut =
  "pointer-events-none -translate-y-1.5 select-none opacity-0 blur-[2px]";

/** Motion tokens mirrored from mobile (Reanimated FadeInDown / label swap). */
export const THINK_SWAP_MS = 150;
export const THINK_SWAP_Y = 6;
export const STEP_ENTER_MS = 220;
export const MESSAGE_ENTER_MS = 220;

/** Message enter: approx mobile spring FadeInDown (Y≈14). */
export const messageEnter =
  "fade-in slide-in-from-bottom-[14px] animate-in fill-mode-both duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none";

/** Timeline / thinking step enter: mobile STEP_ENTER (Y≈6, 220ms). */
export const stepEnter =
  "fade-in slide-in-from-bottom-[6px] animate-in fill-mode-both duration-[220ms] ease-out motion-reduce:animate-none";

/** Thinking label swap enter. */
export const thinkSwapEnter =
  "fade-in slide-in-from-bottom-[6px] animate-in fill-mode-both duration-[150ms] ease-out motion-reduce:animate-none";

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
  ...props
}: ComponentProps<"span"> & { active?: boolean }) {
  return (
    <span
      className={cn(active && "shimmer motion-reduce:animate-none", className)}
      {...props}
    />
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
