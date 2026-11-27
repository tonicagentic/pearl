"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { mono, paper } from "./surfaces";
import { announced, pct } from "../utils/range";
import { formatTokenCount } from "../utils/tokens";

export interface CostLine {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: string;
  share: number;
}

export function CostMeter({
  runCost,
  sessionCost,
  lines,
  className,
  ...props
}: Omit<
  ComponentProps<"div">,
  "children" | "runCost" | "sessionCost" | "lines"
> & {
  runCost: string;
  sessionCost: string;
  lines: readonly CostLine[];
}) {
  return (
    <div
      data-slot="cost-meter"
      className={cn(
        paper,
        "bg-card flex w-full flex-col gap-3 rounded-2xl p-4 dark:bg-card",
        className,
      )}
      {...props}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-foreground text-2xl font-medium tabular-nums tracking-tight">
          {runCost}
        </span>
        <span className="text-muted-foreground text-xs">this run</span>
        <span
          className={cn(mono, "text-muted-foreground ms-auto tabular-nums")}
        >
          {sessionCost} session
        </span>
      </div>

      <div className="bg-foreground/[0.06] flex h-1.5 w-full overflow-hidden rounded-full">
        {lines.map((line, i) => {
          const width = pct(line.share, 1);
          if (announced(width) === 0) return null;
          return (
            <span
              key={line.model}
              role="meter"
              aria-label={`${line.model} cost share`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={announced(width)}
              className={cn(
                "h-full transition-[width] duration-500 forced-color-adjust-none motion-reduce:transition-none",
                i === 0
                  ? "bg-blue-500 dark:bg-blue-400"
                  : i === 1
                    ? "bg-blue-500/55 dark:bg-blue-400/55"
                    : "bg-foreground/25",
              )}
              style={{ width: `${width}%` }}
            />
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        {lines.map((line) => (
          <div
            key={line.model}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
          >
            <span className="text-foreground min-w-0 truncate text-sm">
              {line.model}
            </span>
            <span
              className={cn(
                mono,
                "text-muted-foreground truncate tabular-nums",
              )}
            >
              {formatTokenCount(line.inputTokens)} in ·{" "}
              {formatTokenCount(line.outputTokens)} out
            </span>
            <span
              className={cn(mono, "text-foreground/75 ms-auto shrink-0 tabular-nums")}
            >
              {line.cost}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
