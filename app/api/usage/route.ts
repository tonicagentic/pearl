import { NextResponse } from "next/server";

import { usageByPeriod } from "@/lib/billing/ledger";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

/**
 * Per-user spend from the usage ledger: total across all periods, plus
 * per-period totals broken down by source. Used by the mobile Usage screen.
 */
export async function GET(request: Request) {
  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup, request.headers);
  if (!viewer || setup.storageMode !== "database") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const summary = await usageByPeriod(viewer.id);

  return NextResponse.json({
    totalCents: summary.totalCents,
    periods: summary.periods.map((period) => ({
      periodStart: period.periodStart.toISOString(),
      totalCents: period.totalCents,
      bySource: period.bySource,
    })),
  });
}
