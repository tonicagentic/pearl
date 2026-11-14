import { NextResponse } from "next/server";

import {
  deleteIcloudCalendarAccount,
  getIcloudCalendarAccountForUser,
  listIcloudCalendarAccountSummaries,
} from "@/lib/calendar/icloud-accounts";
import { RateLimitError, enforceRateLimit } from "@/lib/rate-limit";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

const PRIVATE = { "Cache-Control": "private, no-store" };

/** Disconnect one iCloud Calendar account and delete its encrypted credentials. */
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const browserOrigin = request.headers.get("origin");
  if (browserOrigin && browserOrigin !== origin) {
    return NextResponse.json(
      { error: "Origin not allowed." },
      { status: 403, headers: PRIVATE },
    );
  }

  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup, request.headers);
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in required." },
      { status: 401, headers: PRIVATE },
    );
  }
  if (setup.authMode !== "email" && setup.authMode !== "vercel") {
    return NextResponse.json(
      { error: "A personal account is required." },
      { status: 403, headers: PRIVATE },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    accountId?: unknown;
  } | null;
  if (typeof body?.accountId !== "string" || !body.accountId.trim()) {
    return NextResponse.json(
      { error: "accountId is required." },
      { status: 400, headers: PRIVATE },
    );
  }

  const account = await getIcloudCalendarAccountForUser(
    viewer.id,
    body.accountId.trim(),
  );
  if (!account) {
    return NextResponse.json(
      { error: "Unknown calendar account." },
      { status: 404, headers: PRIVATE },
    );
  }

  try {
    await enforceRateLimit({
      key: viewer.id,
      prefix: "calendar-accounts-revoke",
      limit: 12,
      windowSeconds: 300,
    });
    await deleteIcloudCalendarAccount(viewer.id, account.id);
    const accounts = await listIcloudCalendarAccountSummaries(viewer.id);
    return NextResponse.json({ accounts }, { headers: PRIVATE });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: 429,
          headers: { ...PRIVATE, "Retry-After": String(error.retryAfter) },
        },
      );
    }
    return NextResponse.json(
      { error: "Could not disconnect calendar account." },
      { status: 502, headers: PRIVATE },
    );
  }
}
