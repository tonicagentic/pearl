import { NextResponse } from "next/server";

import {
  getBillingAccess,
  getUserBillingFlags,
  isBillingActive,
} from "@/lib/billing/accounts";
import { isBillingProvidersConfigured } from "@/lib/billing/config";
import { createSubscriptionCheckoutSession } from "@/lib/billing/stripe";
import { RateLimitError, enforceRateLimit } from "@/lib/rate-limit";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

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
      prefix: "billing-checkout",
      windowSeconds: 60,
    });

    if (!(await isBillingActive())) {
      return NextResponse.json(
        { error: "Billing is not enabled on this deployment." },
        { status: 400 },
      );
    }

    const flags = await getUserBillingFlags(viewer.id);
    if (!flags) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    if (flags.exempt) {
      return NextResponse.json(
        { error: "This account has a free pass and does not need a subscription." },
        { status: 400 },
      );
    }

    if (!isBillingProvidersConfigured()) {
      return NextResponse.json(
        { error: "Billing is not configured." },
        { status: 503 },
      );
    }

    const access = await getBillingAccess(viewer.id);
    if (access.allowed && access.status === "active") {
      return NextResponse.json(
        { error: "Subscription already active.", status: access.status },
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

    const session = await createSubscriptionCheckoutSession({
      userId: viewer.id,
      email: flags.email,
      stripeCustomerId: access.stripeCustomerId,
      cancelPath,
      successPath,
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
    console.error("[billing/checkout]", error);
    return NextResponse.json(
      { error: "Could not start checkout." },
      { status: 500 },
    );
  }
}
