import { NextResponse } from "next/server";

import {
  getBillingAccess,
  getUserBillingFlags,
  isBillingActive,
  upsertBillingAccount,
} from "@/lib/billing/accounts";
import { isBillingProvidersConfigured } from "@/lib/billing/config";
import { createExtendedUsageSetupSession } from "@/lib/billing/stripe";
import { RateLimitError, enforceRateLimit } from "@/lib/rate-limit";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

/**
 * Apple (or other) subscribers attach a Stripe payment method for Metronome
 * pay-as-you-go usage. Web only — not offered as an in-app iOS purchase CTA.
 */
export async function POST(request: Request) {
  try {
    const setup = await getSetupStatus();
    const viewer = await getServerViewer(setup);
    if (!viewer || setup.storageMode !== "database") {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    await enforceRateLimit({
      key: viewer.id,
      limit: 10,
      prefix: "billing-extended-usage",
      windowSeconds: 60,
    });

    if (!(await isBillingActive())) {
      return NextResponse.json(
        { error: "Billing is not enabled on this deployment." },
        { status: 400 },
      );
    }

    if (!isBillingProvidersConfigured()) {
      return NextResponse.json(
        { error: "Billing is not configured." },
        { status: 503 },
      );
    }

    const flags = await getUserBillingFlags(viewer.id);
    if (!flags) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    if (flags.exempt) {
      return NextResponse.json(
        { error: "This account has a free pass." },
        { status: 400 },
      );
    }

    const access = await getBillingAccess(viewer.id);
    if (!access.allowed || access.exempt || access.trial) {
      return NextResponse.json(
        { error: "An active subscription is required first." },
        { status: 400 },
      );
    }
    if (access.hasExtendedUsageBilling) {
      return NextResponse.json(
        { error: "Automatic usage billing is already enabled." },
        { status: 400 },
      );
    }

    let cancelPath = "/billing";
    let successPath = "/billing/success";
    try {
      const body = (await request.json()) as {
        cancelPath?: string;
        successPath?: string;
      };
      if (
        typeof body.cancelPath === "string" &&
        body.cancelPath.startsWith("/") &&
        !body.cancelPath.startsWith("//")
      ) {
        cancelPath = body.cancelPath;
      }
      if (
        typeof body.successPath === "string" &&
        body.successPath.startsWith("/") &&
        !body.successPath.startsWith("//")
      ) {
        successPath = body.successPath;
      }
    } catch {
      // empty body is fine
    }

    const session = await createExtendedUsageSetupSession({
      userId: viewer.id,
      email: flags.email,
      stripeCustomerId: access.stripeCustomerId,
      cancelPath,
      successPath,
    });

    // Persist the Stripe customer immediately so the setup webhook can resolve
    // the billing row before Metronome is attached.
    await upsertBillingAccount({
      userId: viewer.id,
      stripeCustomerId: session.stripeCustomerId,
      status: access.status ?? "active",
      paymentProvider: access.paymentProvider ?? "apple",
      metronomeCustomerId: access.metronomeCustomerId,
    });

    return NextResponse.json({ url: session.url, sessionId: session.sessionId });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfter) },
        },
      );
    }
    console.error("[billing/extended-usage]", error);
    return NextResponse.json(
      { error: "Could not start extended usage billing." },
      { status: 500 },
    );
  }
}
