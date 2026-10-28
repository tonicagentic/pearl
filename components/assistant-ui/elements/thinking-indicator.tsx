"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { ShimmerLabel, thinkSwapEnter, threadMeta } from "./surfaces";

export function ThinkingIndicator({
  label,
  elapsed,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children" | "label" | "elapsed"> & {
  label: string;
  elapsed?: string;
}) {
  return (
    <div
      data-slot="thinking-indicator"
      className={cn("flex items-center gap-1.5 py-0.5", threadMeta, className)}
      {...props}
    >
      <ShimmerLabel
        key={label}
        className={cn("relative inline-block", thinkSwapEnter)}
      >
        {label}
      </ShimmerLabel>
      {elapsed !== undefined && (
        <span className="tabular-nums opacity-80">{elapsed}</span>
      )}
    </div>
  );
}
