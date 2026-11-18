import type { Metadata } from "next";
import { Fragment, Suspense, type ReactNode } from "react";
import {
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  CoinsIcon,
  GaugeIcon,
  Loader2Icon,
} from "lucide-react";

import { BillingPanel } from "@/components/billing/billing-panel";
import { UsageFilterBar } from "@/components/billing/usage-filter-bar";
import {
  getBillingAccess,
  resolvePeriod,
} from "@/lib/billing/accounts";
import {
  usageByPeriod,
  usageSourceDetailsInRange,
} from "@/lib/billing/ledger";
import { getUserUsageRows } from "@/lib/db/queries";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";
import { formatSpendUsd } from "@/lib/billing/provider-pricing";
import {
  formatEventRate,
  unitNounForSource,
  usageSourceMeta,
} from "@/lib/usage/sources";
import {
  aggregateUsage,
  formatTokens,
  formatUsd,
  type UsageBreakdownEntry,
} from "@/lib/usage/usage";
import {
  attachPeriodEnds,
  resolveUsageWindow,
} from "@/lib/usage/window";

export const metadata: Metadata = {
  title: "Usage",
};

/**
 * Static shell: with cacheComponents, every uncached read (headers via auth,
 * database queries) must live inside a Suspense boundary so the route can
 * prerender its frame — same pattern as the shell's hidden ResolvedChatBootstrap.
 */
export default function SettingsPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <SettingsPageFrame>
      <Suspense fallback={<UsageFallback />}>
        <ResolvedUsage searchParams={searchParams} />
      </Suspense>
    </SettingsPageFrame>
  );
}

function param(
  value: string | string[] | undefined,
): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatPeriodChip(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}


async function ResolvedUsage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);
  const params = await searchParams;

  if (!viewer || setupStatus.storageMode !== "database") {
    return (
      <SignedOutCard
        message={
          setupStatus.storageMode === "database"
            ? "Sign in to see your usage."
            : "Usage tracking needs database persistence."
        }
      />
    );
  }

  const access = await getBillingAccess(viewer.id);
  const currentPeriod = resolvePeriod({
    periodStart: access.periodStart,
    periodEnd: access.periodEnd,
  });
  const periodSummary = await usageByPeriod(viewer.id);
  const periodsWithEnds = attachPeriodEnds(
    periodSummary.periods.map((period) => ({
      periodStart: period.periodStart,
      totalCents: period.totalCents,
    })),
    currentPeriod.end,
  );

  const window = resolveUsageWindow({
    preset: param(params.preset),
    periodStart: param(params.periodStart),
    from: param(params.from),
    to: param(params.to),
    currentPeriod,
    periods: periodsWithEnds,
  });
  const range = { from: window.from, to: window.to };

  const [rows, ledger] = await Promise.all([
    getUserUsageRows(viewer.id, range),
    usageSourceDetailsInRange(viewer.id, range),
  ]);
  const summary = aggregateUsage(rows);
  const sourceRows = ledger.bySource.map((row) => {
    const meta = usageSourceMeta(row.source);
    const unitUsd = row.unitUsd ?? meta.unitUsd;
    return {
      ...row,
      label: meta.label,
      provider: meta.provider,
      pricingNote: meta.pricingNote,
      unitUsd,
      rateLabel: formatEventRate({
        eventCount: row.eventCount,
        costUsd: row.costUsd,
        unitUsd,
        unitNoun: unitNounForSource(row.source),
      }),
      subgroups: row.subgroups.map((subgroup) => ({
        ...subgroup,
        rateLabel: formatEventRate({
          eventCount: subgroup.eventCount,
          costUsd: subgroup.costUsd,
          unitUsd: subgroup.unitUsd,
          unitNoun: unitNounForSource(row.source),
        }),
      })),
    };
  });

  const activePreset = window.preset;
  const chips = [
    {
      href: "/settings?preset=cycle",
      label: "This cycle",
      active: activePreset === "cycle",
    },
    {
      href: "/settings?preset=7d",
      label: "7 days",
      active: activePreset === "7d",
    },
    {
      href: "/settings?preset=30d",
      label: "30 days",
      active: activePreset === "30d",
    },
    {
      href: "/settings?preset=all",
      label: "All time",
      active: activePreset === "all",
    },
    ...periodsWithEnds
      .filter(
        (period) =>
          period.periodStart.getTime() !== currentPeriod.start.getTime(),
      )
      .slice()
      .reverse()
      .slice(0, 6)
      .map((period) => {
        const startIso = period.periodStart.toISOString();
        return {
          href: `/settings?periodStart=${encodeURIComponent(startIso)}`,
          label: formatPeriodChip(startIso),
          active:
            activePreset === "period" &&
            window.periodStart === startIso,
        };
      }),
  ];

  return (
    <>
      <header>
        <h1 className="text-lg font-semibold">Usage</h1>
        <p className="text-sm text-muted-foreground">
          Billed spend and model tokens for {window.label.toLowerCase()}.
        </p>
      </header>

      <BillingPanel />

      <UsageFilterBar chips={chips} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          icon={<CoinsIcon className="size-3.5" />}
          label="Billed"
          value={formatSpendUsd(ledger.totalUsd)}
          hint={
            summary.totals.costUsd === null
              ? undefined
              : `models ${formatUsd(summary.totals.costUsd)}`
          }
        />
        <StatTile
          icon={<ArrowDownToLineIcon className="size-3.5" />}
          label="Input"
          value={formatTokens(summary.totals.inputTokens)}
          hint={`${formatTokens(summary.totals.cacheReadTokens)} from cache`}
        />
        <StatTile
          icon={<ArrowUpFromLineIcon className="size-3.5" />}
          label="Output"
          value={formatTokens(summary.totals.outputTokens)}
        />
        <StatTile
          icon={<GaugeIcon className="size-3.5" />}
          label="Turns"
          value={String(summary.turns)}
          hint={`${String(summary.totals.modelCalls)} model calls`}
        />
      </div>

      <SourceDetailTable
        rows={sourceRows}
        emptyMessage="No billed spend in this range."
      />

      <UsageTable
        title="By model"
        rows={summary.byModel}
        emptyMessage="No model usage in this range."
      />

      <UsageTable
        title="By day"
        rows={summary.byDay.map((entry) => ({ ...entry, label: entry.day }))}
        emptyMessage="No usage yet."
      />

      <p className="text-xs text-muted-foreground">
        Billed spend comes from the usage ledger. Token and model totals come
        from the chat event log on the server — browser-only chats are not
        included, and turns whose tab closed mid-stream may be incomplete.
      </p>
    </>
  );
}

function UsageFallback() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
      Loading your usage…
    </div>
  );
}

/**
 * The (chat) shell renders `main` as a non-scrolling flex column with the
 * sidebar/menu controls absolutely positioned over the top edge, so route
 * content must fill `main` (flex min-h-0 flex-1) and provide its own scroll
 * container plus top clearance for those controls — same contract the chat
 * surface follows.
 */
function SettingsPageFrame({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="h-full overflow-y-auto px-4 pt-14 pb-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          {children}
        </div>
      </div>
    </div>
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

type UsageRowView = UsageBreakdownEntry;

type SourceDetailRow = {
  readonly source: string;
  readonly label: string;
  readonly provider: string;
  readonly pricingNote: string;
  readonly costUsd: number;
  readonly eventCount: number;
  readonly rateLabel: string;
  readonly subgroups: readonly {
    readonly label: string;
    readonly costUsd: number;
    readonly eventCount: number;
    readonly rateLabel: string;
  }[];
};

function SourceDetailTable({
  rows,
  emptyMessage,
}: {
  readonly rows: readonly SourceDetailRow[];
  readonly emptyMessage: string;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-foreground">By source</h2>
      {rows.length === 0 ? (
        <p className="rounded-lg border bg-card px-3 py-4 text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Rate</th>
                <th className="px-3 py-2 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.source}>
                  <tr className="border-b last:border-b-0">
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium">{row.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.provider}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.pricingNote}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-muted-foreground">
                      {row.rateLabel}
                    </td>
                    <NumCell value={formatSpendUsd(row.costUsd)} />
                  </tr>
                  {row.subgroups.map((subgroup) => (
                    <tr
                      key={`${row.source}:${subgroup.label}`}
                      className="border-b bg-muted/20 last:border-b-0"
                    >
                      <td className="px-3 py-2 pl-6 align-top text-muted-foreground">
                        {subgroup.label}
                      </td>
                      <td className="px-3 py-2 align-top text-muted-foreground">
                        {subgroup.rateLabel}
                      </td>
                      <NumCell value={formatSpendUsd(subgroup.costUsd)} />
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function UsageTable({
  title,
  rows,
  emptyMessage,
}: {
  readonly title: string;
  readonly rows: readonly UsageRowView[];
  readonly emptyMessage: string;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-foreground">{title}</h2>
      {rows.length === 0 ? (
        <p className="rounded-lg border bg-card px-3 py-4 text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Period</th>
                <th className="px-3 py-2 text-right font-medium">Calls</th>
                <th className="px-3 py-2 text-right font-medium">In</th>
                <th className="px-3 py-2 text-right font-medium">Out</th>
                <th className="px-3 py-2 text-right font-medium">Cached</th>
                <th className="px-3 py-2 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b last:border-b-0">
                  <td className="max-w-56 truncate px-3 py-2">{row.label}</td>
                  <NumCell value={row.modelCalls} />
                  <NumCell value={formatTokens(row.inputTokens)} />
                  <NumCell value={formatTokens(row.outputTokens)} />
                  <NumCell value={formatTokens(row.cacheReadTokens)} />
                  <NumCell value={formatUsd(row.costUsd)} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function NumCell({ value }: { readonly value: string | number }) {
  return (
    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
      {value}
    </td>
  );
}

function SignedOutCard({ message }: { readonly message: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-base font-medium">Usage</div>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
