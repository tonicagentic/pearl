import { NextResponse } from "next/server";

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
import {
  formatEventRate,
  unitNounForSource,
  usageSourceMeta,
} from "@/lib/usage/sources";
import { aggregateUsage } from "@/lib/usage/usage";
import {
  attachPeriodEnds,
  resolveUsageWindow,
} from "@/lib/usage/window";

/**
 * Usage for the signed-in account: billed ledger totals (by source) plus
 * chat-event model tokens/cost (by model / day), filterable by billing cycle
 * or date range. Used by mobile and web settings Usage.
 */
export async function GET(request: Request) {
  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup, request.headers);
  if (!viewer || setup.storageMode !== "database") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const url = new URL(request.url);
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
    preset: url.searchParams.get("preset"),
    periodStart: url.searchParams.get("periodStart"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    currentPeriod,
    periods: periodsWithEnds,
  });

  const range = { from: window.from, to: window.to };
  const [ledger, rows] = await Promise.all([
    usageSourceDetailsInRange(viewer.id, range),
    getUserUsageRows(viewer.id, range),
  ]);
  const models = aggregateUsage(rows);

  const bySource = ledger.bySource.map((row) => {
    const meta = usageSourceMeta(row.source);
    const unitUsd = row.unitUsd ?? meta.unitUsd;
    return {
      source: row.source,
      label: meta.label,
      provider: meta.provider,
      pricingNote: meta.pricingNote,
      costUsd: row.costUsd,
      costMicros: row.costMicros,
      costCents: row.costCents,
      eventCount: row.eventCount,
      unitUsd,
      rateLabel: formatEventRate({
        eventCount: row.eventCount,
        costUsd: row.costUsd,
        unitUsd,
        unitNoun: unitNounForSource(row.source),
      }),
      subgroups: row.subgroups.map((subgroup) => ({
        label: subgroup.label,
        costUsd: subgroup.costUsd,
        costMicros: subgroup.costMicros,
        costCents: subgroup.costCents,
        eventCount: subgroup.eventCount,
        unitUsd: subgroup.unitUsd,
        rateLabel: formatEventRate({
          eventCount: subgroup.eventCount,
          costUsd: subgroup.costUsd,
          unitUsd: subgroup.unitUsd,
          unitNoun: unitNounForSource(row.source),
        }),
      })),
    };
  });

  return NextResponse.json({
    filter: {
      preset: window.preset,
      periodStart: window.periodStart,
      from: window.from?.toISOString() ?? null,
      to: window.to?.toISOString() ?? null,
      label: window.label,
    },
    currentPeriod: {
      start: currentPeriod.start.toISOString(),
      end: currentPeriod.end.toISOString(),
    },
    periods: periodsWithEnds
      .map((period) => ({
        periodStart: period.periodStart.toISOString(),
        periodEnd: period.periodEnd?.toISOString() ?? null,
        totalCents: period.totalCents,
      }))
      .sort(
        (a, b) =>
          new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime(),
      ),
    totalUsd: ledger.totalUsd,
    totalCents: ledger.totalCents,
    bySource,
    ledger: {
      totalUsd: ledger.totalUsd,
      totalCents: ledger.totalCents,
      bySource,
    },
    models: {
      totals: models.totals,
      turns: models.turns,
      byDay: models.byDay,
      byModel: models.byModel,
    },
  });
}
