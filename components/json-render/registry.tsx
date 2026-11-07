"use client";

import { defineRegistry } from "@json-render/react";
import { chatCatalog } from "@/lib/json-render/catalog";
import { comparisonBarShares } from "@/lib/json-render/comparison-bar";
import { cn } from "@/lib/utils";
import { Button as UiButton } from "@/components/ui/button";

const gapClass = {
  sm: "gap-2",
  md: "gap-3",
  lg: "gap-4",
} as const;

const badgeToneClass = {
  neutral: "bg-muted text-muted-foreground",
  positive: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  negative: "bg-red-500/15 text-red-700 dark:text-red-300",
  warning: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
} as const;

function httpsSrc(src: string | null | undefined): string | null {
  if (!src || typeof src !== "string") return null;
  try {
    const url = new URL(src);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export const { registry: chatRegistry } = defineRegistry(chatCatalog, {
  components: {
    Stack: ({ props, children }) => (
      <div
        className={cn(
          "flex",
          props.direction === "horizontal" ? "flex-row flex-wrap items-center" : "flex-col",
          gapClass[props.gap ?? "md"],
        )}
      >
        {children}
      </div>
    ),
    Card: ({ props, children }) => (
      <div className="border-border/60 bg-muted/20 flex flex-col gap-3 rounded-xl border px-3.5 py-3">
        {(props.title || props.description) && (
          <div className="flex flex-col gap-0.5">
            {props.title ? (
              <div className="text-foreground text-[15px] font-medium leading-snug">
                {props.title}
              </div>
            ) : null}
            {props.description ? (
              <div className="text-muted-foreground text-[13.5px] leading-relaxed">
                {props.description}
              </div>
            ) : null}
          </div>
        )}
        {children}
      </div>
    ),
    Divider: () => <hr className="border-border/60 my-1 border-t" />,
    Heading: ({ props }) => {
      const className = cn(
        "text-foreground font-medium",
        props.level === "1" && "text-lg leading-7",
        props.level === "3" && "text-sm leading-5",
        (!props.level || props.level === "2") && "text-base leading-6",
      );
      if (props.level === "1") return <h2 className={className}>{props.text}</h2>;
      if (props.level === "3") return <h4 className={className}>{props.text}</h4>;
      return <h3 className={className}>{props.text}</h3>;
    },
    Text: ({ props }) => (
      <p
        className={cn(
          "text-[15px] leading-6",
          props.muted ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {props.text}
      </p>
    ),
    Metric: ({ props }) => (
      <div className="flex min-w-[7rem] flex-col gap-0.5">
        <div className="text-muted-foreground text-[12.5px] leading-4">{props.label}</div>
        <div className="text-foreground text-xl font-semibold tracking-tight tabular-nums">
          {props.value}
        </div>
        {props.hint ? (
          <div className="text-muted-foreground text-[12px] leading-4">{props.hint}</div>
        ) : null}
      </div>
    ),
    Badge: ({ props }) => (
      <span
        className={cn(
          "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[12px] font-medium",
          badgeToneClass[props.tone ?? "neutral"],
        )}
      >
        {props.label}
      </span>
    ),
    ComparisonBar: ({ props }) => {
      const shares = comparisonBarShares(props.leftValue, props.rightValue);
      return (
        <div className="flex w-full flex-col gap-1.5">
          <div className="text-foreground flex items-baseline justify-between gap-3 text-[13px] font-medium">
            <span>
              {props.leftLabel}{" "}
              <span className="tabular-nums">{props.leftValue}%</span>
            </span>
            <span className="text-right">
              {props.rightLabel}{" "}
              <span className="tabular-nums">{props.rightValue}%</span>
            </span>
          </div>
          <div
            className="bg-muted flex h-2.5 w-full overflow-hidden rounded-full"
            role="img"
            aria-label={`${props.leftLabel} ${props.leftValue}%, ${props.rightLabel} ${props.rightValue}%`}
          >
            <div
              className="bg-foreground/80 h-full"
              style={{ width: `${shares.left}%` }}
            />
            <div
              className="bg-foreground/25 h-full"
              style={{ width: `${shares.right}%` }}
            />
          </div>
          {props.caption ? (
            <div className="text-muted-foreground text-[12px] leading-4">
              {props.caption}
            </div>
          ) : null}
        </div>
      );
    },
    Table: ({ props }) => (
      <div className="border-border/60 overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[16rem] border-collapse text-left text-[13.5px]">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              {props.columns.map((column) => (
                <th key={column} className="px-2.5 py-1.5 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-border/50 border-t">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="text-foreground px-2.5 py-1.5 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
    Image: ({ props }) => {
      const src = httpsSrc(props.src);
      if (!src) return null;
      return (
        // eslint-disable-next-line @next/next/no-img-element -- generative UI URLs are dynamic https sources
        <img
          src={src}
          alt={props.alt ?? ""}
          className="border-border/50 max-h-64 w-full rounded-lg border object-cover"
        />
      );
    },
    Button: ({ props, emit }) => (
      <UiButton
        type="button"
        size="sm"
        variant={props.variant ?? "default"}
        onClick={() => emit("press")}
      >
        {props.label}
      </UiButton>
    ),
  },
  actions: {
    // Bound at render time via ActionProvider handlers in ChatJsonRender.
    reply: async () => undefined,
  },
});
