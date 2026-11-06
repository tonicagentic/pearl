"use client";

import { useMemo, type ReactNode } from "react";
import {
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  CoinsIcon,
  GaugeIcon,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  threadTraceFromEvents,
  type ThreadTraceEvent,
} from "@/lib/usage/thread-trace";
import { formatTokens, formatUsd } from "@/lib/usage/usage";

export function ThreadCostDrawer({
  open,
  onOpenChange,
  events,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly events: readonly ThreadTraceEvent[];
}) {
  const trace = useMemo(() => threadTraceFromEvents(events), [events]);
  const empty = trace.totals.modelCalls === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] gap-0 rounded-t-2xl p-0 sm:max-w-none"
      >
        <SheetHeader className="border-b px-4 py-3 text-left">
          <SheetTitle>Thread cost</SheetTitle>
          <SheetDescription>
            Model-call cost for this thread, from the live event trace.
          </SheetDescription>
        </SheetHeader>

        <div className="overflow-y-auto px-4 py-4 pb-8">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                icon={<CoinsIcon className="size-3.5" />}
                label="Cost"
                value={formatUsd(trace.totals.costUsd)}
                hint={
                  trace.totals.costUsd === null && !empty
                    ? "no cost reported"
                    : undefined
                }
              />
              <StatTile
                icon={<ArrowDownToLineIcon className="size-3.5" />}
                label="Input"
                value={formatTokens(trace.totals.inputTokens)}
                hint={
                  trace.totals.cacheReadTokens > 0
                    ? `${formatTokens(trace.totals.cacheReadTokens)} from cache`
                    : undefined
                }
              />
              <StatTile
                icon={<ArrowUpFromLineIcon className="size-3.5" />}
                label="Output"
                value={formatTokens(trace.totals.outputTokens)}
              />
              <StatTile
                icon={<GaugeIcon className="size-3.5" />}
                label="Turns"
                value={String(trace.turns)}
                hint={`${String(trace.totals.modelCalls)} model calls`}
              />
            </div>

            {empty ? (
              <p className="rounded-lg border bg-card px-3 py-4 text-sm text-muted-foreground">
                No model calls in this thread yet.
              </p>
            ) : (
              <>
                <section>
                  <h2 className="mb-2 text-sm font-medium">By model</h2>
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Model</th>
                          <th className="px-3 py-2 text-right font-medium">Calls</th>
                          <th className="px-3 py-2 text-right font-medium">In</th>
                          <th className="px-3 py-2 text-right font-medium">Out</th>
                          <th className="px-3 py-2 text-right font-medium">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trace.byModel.map((row) => (
                          <tr key={row.label} className="border-b last:border-b-0">
                            <td className="max-w-48 truncate px-3 py-2">{row.label}</td>
                            <NumCell value={row.modelCalls} />
                            <NumCell value={formatTokens(row.inputTokens)} />
                            <NumCell value={formatTokens(row.outputTokens)} />
                            <NumCell value={formatUsd(row.costUsd)} />
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section>
                  <h2 className="mb-2 text-sm font-medium">Trace</h2>
                  <div className="flex flex-col gap-3">
                    {trace.callTurns.map((turn) => (
                      <div
                        key={turn.turnId ?? turn.label}
                        className="overflow-hidden rounded-lg border"
                      >
                        <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                          {turn.label}
                        </div>
                        <ul className="divide-y">
                          {turn.calls.map((call, index) => (
                            <li
                              key={`${turn.turnId ?? "turn"}-${call.stepIndex ?? index}`}
                              className="flex items-start justify-between gap-3 px-3 py-2 text-sm"
                            >
                              <div className="min-w-0">
                                <div className="truncate font-medium">
                                  {call.modelId ?? "unknown"}
                                </div>
                                <div className="text-xs text-muted-foreground tabular-nums">
                                  {formatTokens(call.inputTokens ?? 0)} in ·{" "}
                                  {formatTokens(call.outputTokens ?? 0)} out
                                  {(call.cacheReadTokens ?? 0) > 0
                                    ? ` · ${formatTokens(call.cacheReadTokens ?? 0)} cached`
                                    : ""}
                                </div>
                              </div>
                              <div className="shrink-0 tabular-nums text-muted-foreground">
                                {formatUsd(call.costUsd)}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StatTile({
  icon,
  label,
  value,
  hint,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function NumCell({ value }: { readonly value: string | number }) {
  return (
    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
      {value}
    </td>
  );
}
