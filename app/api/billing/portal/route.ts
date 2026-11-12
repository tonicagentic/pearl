import { NextResponse } from "next/server";

import { getBillingAccess, isBillingActive } from "@/lib/billing/accounts";
import { createCustomerPortalSession } from "@/lib/billing/stripe";
import { RateLimitError, enforceRateLimit } from "@/lib/rate-limit";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export async function POST() {
  try {
    const setup = await getSetupStatus();
    const viewer = await getServerViewer(setup);
    if (!viewer || setup.storageMode !== "database") {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    await enforceRateLimit({
      key: viewer.id,
      limit: 10,
      prefix: "billing-portal",
      windowSeconds: 60,
    });

    if (!(await isBillingActive())) {
      return NextResponse.json(
        { error: "Billing is not enabled." },
        { status: 400 },
      );
    }

    const access = await getBillingAccess(viewer.id);
    if (access.exempt) {
      return NextResponse.json(
        { error: "Free-pass accounts have no Stripe portal." },
        { status: 400 },
      );
    }
    if (!access.stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer yet. Subscribe first." },
        { status: 400 },
      );
    }

    const session = await createCustomerPortalSession({
      stripeCustomerId: access.stripeCustomerId,
      returnPath: "/settings",
    });

    return NextResponse.json({ url: session.url });
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
    console.error("[billing/portal]", error);
    return NextResponse.json(
      { error: "Could not open billing portal." },
      { status: 500 },
    );
  }
}
