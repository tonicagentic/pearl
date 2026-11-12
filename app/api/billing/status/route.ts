import { NextResponse } from "next/server";

import { getBillingAccess, isBillingActive } from "@/lib/billing/accounts";
import { blockMessage } from "@/lib/billing/config";
import { usageBreakdownBySource } from "@/lib/billing/ledger";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export async function GET() {
  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup);
  if (!viewer || setup.storageMode !== "database") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const enabled = await isBillingActive();
  if (!enabled) {
    return NextResponse.json({
      enabled: false,
      allowed: true,
      exempt: false,
      needsCheckout: false,
    });
  }

  const access = await getBillingAccess(viewer.id);
  const bySource =
    access.periodStart != null
      ? await usageBreakdownBySource(viewer.id, access.periodStart)
      : [];

  return NextResponse.json({
    enabled: true,
    allowed: access.allowed,
    exempt: access.exempt,
    needsCheckout: !access.exempt && !access.allowed && access.reason === "unpaid",
    reason: access.reason,
    message: access.reason ? blockMessage(access.reason) : null,
    status: access.status,
    usageCapCents: access.usageCapCents,
    spentCents: access.spentCents,
    reservedCents: access.reservedCents,
    remainingCents:
      access.usageCapCents == null
        ? null
        : Math.max(0, access.usageCapCents - access.spentCents - access.reservedCents),
    periodStart: access.periodStart?.toISOString() ?? null,
    periodEnd: access.periodEnd?.toISOString() ?? null,
    hasPortal: Boolean(access.stripeCustomerId) && !access.exempt,
    bySource,
  });
}
