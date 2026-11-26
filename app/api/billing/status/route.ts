import { NextResponse } from "next/server";

import { getBillingAccess, isBillingActive } from "@/lib/billing/accounts";
import {
  DEFAULT_USAGE_CAP_CENTS,
  INCLUDED_USAGE_CENTS,
  SUBSCRIPTION_PRICE_CENTS,
  blockMessage,
  getTrialCapCents,
} from "@/lib/billing/config";
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
      trial: false,
      guest: false,
      needsCheckout: false,
      guestMessageCount: 0,
      guestMessageLimit: 3,
      needsSignup: false,
    });
  }

  const access = await getBillingAccess(viewer.id);
  const bySource =
    access.periodStart != null
      ? await usageBreakdownBySource(viewer.id, access.periodStart)
      : [];

  const remainingCents =
    access.usageCapCents == null
      ? null
      : Math.max(
          0,
          access.usageCapCents - access.spentCents - access.reservedCents,
        );

  return NextResponse.json({
    enabled: true,
    allowed: access.allowed,
    exempt: access.exempt,
    trial: access.trial,
    guest: access.guest,
    needsCheckout:
      !access.exempt &&
      !access.trial &&
      !access.guest &&
      !access.allowed &&
      access.reason === "unpaid",
    needsSignup:
      access.guest &&
      !access.allowed &&
      access.reason === "guest_limit_reached",
    reason: access.reason,
    message: access.reason ? blockMessage(access.reason) : null,
    status: access.status,
    usageCapCents: access.usageCapCents,
    spentCents: access.spentCents,
    reservedCents: access.reservedCents,
    remainingCents,
    includedUsageCents: INCLUDED_USAGE_CENTS,
    subscriptionPriceCents: SUBSCRIPTION_PRICE_CENTS,
    defaultSpendCapCents: DEFAULT_USAGE_CAP_CENTS,
    trialCapCents: getTrialCapCents(),
    guestMessageCount: access.guestMessageCount,
    guestMessageLimit: access.guestMessageLimit,
    periodStart: access.periodStart?.toISOString() ?? null,
    periodEnd: access.periodEnd?.toISOString() ?? null,
    paymentProvider: access.paymentProvider,
    prepaidCreditCents: access.prepaidCreditCents,
    hasAppleSubscription: access.hasAppleSubscription,
    hasExtendedUsageBilling: access.hasExtendedUsageBilling,
    hasPortal:
      Boolean(access.stripeCustomerId) && !access.exempt && !access.trial,
    canManageCap:
      Boolean(access.stripeCustomerId) && !access.exempt && !access.trial,
    bySource,
  });
}
