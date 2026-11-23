import { NextResponse } from "next/server";

import { applyVerifiedAppleTransaction } from "@/lib/billing/apple";
import { isBillingActive } from "@/lib/billing/accounts";
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
      limit: 30,
      prefix: "billing-apple-verify",
      windowSeconds: 60,
    });

    if (!(await isBillingActive())) {
      return NextResponse.json(
        { error: "Billing is not enabled on this deployment." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as {
      signedTransaction?: unknown;
      jws?: unknown;
    };
    const signedTransaction =
      typeof body.signedTransaction === "string"
        ? body.signedTransaction
        : typeof body.jws === "string"
          ? body.jws
          : null;
    if (!signedTransaction?.trim()) {
      return NextResponse.json(
        { error: "signedTransaction is required." },
        { status: 400 },
      );
    }

    const result = await applyVerifiedAppleTransaction({
      userId: viewer.id,
      signedTransaction: signedTransaction.trim(),
    });

    return NextResponse.json({ ok: true, ...result });
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
    console.error("[billing/apple/verify]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not verify Apple purchase.",
      },
      { status: 400 },
    );
  }
}
