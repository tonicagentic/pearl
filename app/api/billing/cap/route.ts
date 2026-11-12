import { NextResponse } from "next/server";

import {
  getBillingAccess,
  isBillingActive,
  setUsageCapCents,
} from "@/lib/billing/accounts";
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
      limit: 20,
      prefix: "billing-cap",
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
        { error: "Free-pass accounts have no spend cap." },
        { status: 400 },
      );
    }
    if (!access.stripeCustomerId) {
      return NextResponse.json(
        { error: "Subscribe before setting a spend cap." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as { usageCapCents?: unknown };
    const cents =
      typeof body.usageCapCents === "number"
        ? body.usageCapCents
        : typeof body.usageCapCents === "string"
          ? Number(body.usageCapCents)
          : Number.NaN;

    if (!Number.isFinite(cents) || cents < 0 || cents > 1_000_000_00) {
      return NextResponse.json(
        { error: "usageCapCents must be between 0 and 100000000." },
        { status: 400 },
      );
    }

    await setUsageCapCents(viewer.id, Math.floor(cents));
    const next = await getBillingAccess(viewer.id);
    return NextResponse.json({
      usageCapCents: next.usageCapCents,
      spentCents: next.spentCents,
      allowed: next.allowed,
      reason: next.reason,
    });
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
    console.error("[billing/cap]", error);
    return NextResponse.json(
      { error: "Could not update spend cap." },
      { status: 500 },
    );
  }
}
