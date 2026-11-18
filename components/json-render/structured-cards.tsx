"use client";

import { WebPreview } from "@/components/assistant-ui/elements/web-preview";
import { Model3DViewer } from "@/components/json-render/model-3d-card";
import {
  clampRevealCount,
  criterionBarPercent,
  scoreRatioTone,
} from "@/lib/json-render/model-3d";
import { cn } from "@/lib/utils";
import { CheckIcon, MinusIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

function MetaLine({ children }: { readonly children: ReactNode }) {
  return <div className="text-muted-foreground text-[12px]">{children}</div>;
}

function PreviewFrame({ url }: { readonly url: string }) {
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);
  let origin = url;
  try {
    origin = new URL(url).host;
  } catch {
    /* keep raw */
  }

  useEffect(() => {
    setLoading(true);
    setKey((k) => k + 1);
  }, [url]);

  if (!url.toLowerCase().startsWith("https://")) {
    return (
      <div className="text-muted-foreground text-[13px]">
        Preview needs an https URL.
      </div>
    );
  }

  return (
    <WebPreview
      origin={origin}
      loading={loading}
      onReload={() => {
        setLoading(true);
        setKey((k) => k + 1);
      }}
      onOpenExternal={() =>
        window.open(url, "_blank", "noopener,noreferrer")
      }
    >
      <iframe
        key={key}
        src={url}
        title="Preview"
        sandbox="allow-scripts allow-forms allow-popups"
        className="h-56 w-full border-0"
        onLoad={() => setLoading(false)}
      />
    </WebPreview>
  );
}

/** Web json-render components for Model3D, WebPreview, Timeline, Comparison, Math, Score. */
export const structuredWebCards = {
  Model3D: ({
    props,
  }: {
    props: {
      src: string;
      title: string | null;
      caption: string | null;
      poster: string | null;
      autoRotate: boolean | null;
    };
  }) => (
    <Model3DViewer
      src={props.src}
      title={props.title}
      caption={props.caption}
      poster={props.poster}
      autoRotate={props.autoRotate}
    />
  ),

  WebPreview: ({
    props,
  }: {
    props: { url: string; title: string | null };
  }) => (
    <div className="flex flex-col gap-2" data-slot="web-preview-card">
      {props.title ? (
        <div className="text-foreground text-[15px] font-medium">{props.title}</div>
      ) : null}
      <PreviewFrame url={props.url} />
    </div>
  ),

  Timeline: ({
    props,
  }: {
    props: {
      events: {
        id: string;
        when: "past" | "now" | "future";
        time: string;
        title: string;
        detail: string | null;
      }[];
      visibleCount: number | null;
    };
  }) => {
    const count = clampRevealCount(props.events.length, props.visibleCount);
    const events = props.events.slice(0, count);
    return (
      <div className="flex flex-col gap-0" data-slot="timeline">
        {events.map((event, index) => {
          const isLast = index === events.length - 1;
          const future = event.when === "future";
          const now = event.when === "now";
          return (
            <div key={event.id} className="grid grid-cols-[3.5rem_1rem_1fr] gap-x-2">
              <div className="text-muted-foreground py-1 text-right font-mono text-[11px] tabular-nums">
                {event.time}
              </div>
              <div className="relative flex flex-col items-center">
                <span
                  className={cn(
                    "mt-1.5 size-2.5 shrink-0 rounded-full",
                    now && "bg-blue-500 ring-2 ring-blue-500/30",
                    event.when === "past" && "bg-muted-foreground/70",
                    future && "border-muted-foreground/50 border-2 bg-transparent",
                  )}
                />
                {!isLast ? (
                  <span
                    className={cn(
                      "mt-1 w-px flex-1",
                      future ? "bg-border/40" : "bg-border/70",
                      "min-h-6",
                    )}
                  />
                ) : null}
              </div>
              <div className="pb-4">
                <div
                  className={cn(
                    "text-[13.5px] leading-snug",
                    now
                      ? "text-foreground font-semibold"
                      : "text-foreground font-medium",
                    future && "text-muted-foreground",
                  )}
                >
                  {event.title}
                </div>
                {event.detail ? (
                  <div className="text-muted-foreground mt-0.5 text-[12px] leading-relaxed">
                    {event.detail}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  },

  ComparisonCard: ({
    props,
  }: {
    props: {
      traitLabels: string[];
      options: {
        id: string;
        name: string;
        headline: string;
        traits: (string | false)[];
      }[];
      recommendedId: string;
      reason: string;
    };
  }) => (
    <div className="flex flex-col gap-3" data-slot="comparison-card">
      <div className="grid gap-2 sm:grid-cols-2">
        {props.options.map((option) => {
          const pick = option.id === props.recommendedId;
          return (
            <div
              key={option.id}
              className={cn(
                "flex flex-col gap-2 rounded-lg border px-3 py-2.5",
                pick
                  ? "border-foreground/30 bg-muted/40"
                  : "border-border/50",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-foreground text-[14px] font-medium">
                  {option.name}
                </span>
                {pick ? (
                  <span className="text-muted-foreground font-mono text-[10px] uppercase">
                    pick
                  </span>
                ) : null}
              </div>
              <MetaLine>{option.headline}</MetaLine>
              <div className="flex flex-col gap-1.5">
                {props.traitLabels.map((label, index) => {
                  const trait = option.traits[index];
                  const present = Boolean(trait);
                  return (
                    <div
                      key={`${option.id}-${label}`}
                      className="flex items-center gap-2 text-[12px]"
                    >
                      {present ? (
                        <CheckIcon className="text-foreground size-3.5 shrink-0" />
                      ) : (
                        <MinusIcon className="text-muted-foreground size-3.5 shrink-0" />
                      )}
                      <span
                        className={
                          present
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }
                      >
                        {present && typeof trait === "string" ? trait : label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-muted-foreground text-[13px] leading-relaxed">
        {props.reason}
      </p>
    </div>
  ),

  MathBlock: ({
    props,
  }: {
    props: {
      label: string | null;
      steps: { expression: string; note: string | null }[];
      visibleSteps: number | null;
    };
  }) => {
    const count = clampRevealCount(props.steps.length, props.visibleSteps);
    const steps = props.steps.slice(0, count);
    return (
      <div className="flex flex-col gap-3" data-slot="math-block">
        {props.label ? (
          <div className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">
            {props.label}
          </div>
        ) : null}
        {steps.map((step, index) => (
          <div key={index} className="flex flex-col gap-0.5">
            <div className="text-foreground font-mono text-[14px] leading-relaxed">
              {step.expression}
            </div>
            {step.note ? <MetaLine>{step.note}</MetaLine> : null}
          </div>
        ))}
      </div>
    );
  },

  ScoreBreakdown: ({
    props,
  }: {
    props: {
      verdict: string;
      total: number;
      outOf: number;
      criteria: {
        label: string;
        score: number;
        weight: number;
        note: string | null;
      }[];
      visibleCount: number | null;
    };
  }) => {
    const tone = scoreRatioTone(props.total, props.outOf);
    const count = clampRevealCount(props.criteria.length, props.visibleCount);
    const criteria = props.criteria.slice(0, count);
    return (
      <div className="flex flex-col gap-3" data-slot="score-breakdown">
        <div className="flex items-baseline gap-2">
          <span className="text-foreground text-2xl font-semibold tabular-nums">
            {props.total.toFixed(1)}
          </span>
          <span className="text-muted-foreground text-[13px]">
            / {props.outOf}
          </span>
          <span
            className={cn(
              "ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
              tone === "positive" &&
                "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
              tone === "warning" &&
                "bg-amber-500/15 text-amber-800 dark:text-amber-200",
              tone === "negative" &&
                "bg-red-500/15 text-red-700 dark:text-red-300",
            )}
          >
            {props.verdict}
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {criteria.map((criterion) => {
            const width = criterionBarPercent(criterion.score, props.outOf);
            return (
              <div key={criterion.label} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="text-foreground font-medium">
                    {criterion.label}
                  </span>
                  <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
                    ×{criterion.weight} · {criterion.score.toFixed(1)}
                  </span>
                </div>
                <div
                  role="meter"
                  aria-valuenow={Math.round(width)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={criterion.label}
                  className="bg-muted h-2 w-full overflow-hidden rounded-full"
                >
                  <div
                    className="bg-foreground/70 h-full rounded-full"
                    style={{ width: `${width}%` }}
                  />
                </div>
                {criterion.note ? <MetaLine>{criterion.note}</MetaLine> : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  },
};
