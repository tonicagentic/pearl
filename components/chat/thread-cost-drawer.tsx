"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { CostMeter } from "@/components/assistant-ui/elements/cost-meter";
import { QuotaBanner } from "@/components/assistant-ui/elements/quota-banner";
import { TraceWaterfall } from "@/components/assistant-ui/elements/trace-waterfall";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  costMeterProps,
  quotaBannerProps,
  type BillingStatusLike,
} from "@/lib/usage/cost-drawer-props";
import {
  threadTraceFromEvents,
  type ThreadTraceEvent,
} from "@/lib/usage/thread-trace";
import { formatUsd } from "@/lib/usage/usage";

export function ThreadCostDrawer({
  open,
  onOpenChange,
  events,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly events: readonly ThreadTraceEvent[];
}) {
  const router = useRouter();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [billing, setBilling] = useState<BillingStatusLike | null>(null);

  useEffect(() => {
    if (!open) return;
    setNowMs(Date.now());
    let cancelled = false;
    void fetch("/api/billing/status")
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as BillingStatusLike;
      })
      .then((body) => {
        if (!cancelled) setBilling(body);
      })
      .catch(() => {
        if (!cancelled) setBilling(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const trace = useMemo(
    () => threadTraceFromEvents(events, { nowMs }),
    [events, nowMs],
  );
  const meter = useMemo(() => costMeterProps(trace), [trace]);
  const quota = useMemo(
    () => quotaBannerProps(billing, { nowMs }),
    [billing, nowMs],
  );
  const empty = trace.totals.modelCalls === 0 && trace.tools.count === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] gap-0 rounded-t-2xl p-0 sm:max-w-none"
      >
        <SheetHeader className="border-b px-4 py-3 text-left">
          <SheetTitle>Thread cost</SheetTitle>
          <SheetDescription>
            Models and tools for this thread, from the live event trace.
          </SheetDescription>
        </SheetHeader>

        <div className="overflow-y-auto px-4 py-4 pb-8">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
            {empty ? (
              <p className="rounded-2xl border bg-card px-3 py-4 text-sm text-muted-foreground">
                No billed usage in this thread yet.
              </p>
            ) : (
              <>
                <CostMeter
                  runCost={meter.runCost}
                  sessionCost={meter.sessionCost}
                  lines={meter.lines}
                />

                {trace.tools.bySource.length > 0 ? (
                  <ul className="flex flex-col gap-1.5 px-1">
                    {trace.tools.bySource.map((row) => (
                      <li
                        key={row.source}
                        className="flex items-baseline justify-between gap-3 text-sm"
                      >
                        <span className="min-w-0 truncate text-muted-foreground">
                          {row.label}
                          <span className="tabular-nums">
                            {" "}
                            · {row.count}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums text-foreground/75">
                          {formatUsd(row.costUsd)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {trace.spans.length > 0 ? (
                  <TraceWaterfall
                    spans={trace.spans}
                    totalMs={trace.totalMs}
                    visibleCount={trace.spans.length}
                  />
                ) : null}
              </>
            )}

            {quota ? (
              <QuotaBanner
                used={quota.used}
                limit={quota.limit}
                unit={quota.unit}
                resetsIn={quota.resetsIn}
                upgradeLabel="Upgrade"
                onUpgrade={() => {
                  onOpenChange(false);
                  router.push("/settings");
                }}
              />
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
