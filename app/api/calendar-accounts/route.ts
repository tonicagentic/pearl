import { NextResponse } from "next/server";

import {
  createIcloudCalendarAccount,
  listIcloudCalendarAccountSummaries,
} from "@/lib/calendar/icloud-accounts";
import { IcloudCalDavError } from "@/lib/calendar/icloud-caldav";
import {
  SecretCryptoError,
  credentialsKeyConfigured,
} from "@/lib/crypto/secrets";
import { RateLimitError, enforceRateLimit } from "@/lib/rate-limit";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

const PRIVATE = { "Cache-Control": "private, no-store" };

/** List linked iCloud Calendar accounts for the signed-in user. */
export async function GET(request: Request) {
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

  try {
    await enforceRateLimit({
      key: viewer.id,
      prefix: "calendar-accounts-list",
      limit: 30,
      windowSeconds: 300,
    });
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
      { error: "Could not load calendar accounts." },
      { status: 503, headers: PRIVATE },
    );
  }

  const accounts = await listIcloudCalendarAccountSummaries(viewer.id);
  return NextResponse.json(
    {
      accounts,
      available: credentialsKeyConfigured(),
    },
    { headers: PRIVATE },
  );
}

/** Link an iCloud Calendar account with Apple ID + app-specific password. */
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

  if (!credentialsKeyConfigured()) {
    return NextResponse.json(
      { error: "iCloud Calendar is not available on this deployment." },
      { status: 409, headers: PRIVATE },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    appleId?: unknown;
    appSpecificPassword?: unknown;
    nickname?: unknown;
  } | null;

  const appleId =
    typeof body?.appleId === "string" ? body.appleId.trim() : "";
  const appSpecificPassword =
    typeof body?.appSpecificPassword === "string"
      ? body.appSpecificPassword.trim()
      : "";
  const nickname =
    typeof body?.nickname === "string" ? body.nickname.trim() : null;

  if (!appleId || !appSpecificPassword) {
    return NextResponse.json(
      { error: "Apple ID and app-specific password are required." },
      { status: 400, headers: PRIVATE },
    );
  }

  try {
    await enforceRateLimit({
      key: viewer.id,
      prefix: "calendar-accounts-create",
      limit: 8,
      windowSeconds: 300,
    });

    const account = await createIcloudCalendarAccount({
      userId: viewer.id,
      appleId,
      appSpecificPassword,
      nickname,
    });
    const accounts = await listIcloudCalendarAccountSummaries(viewer.id);
    return NextResponse.json(
      { account, accounts },
      { headers: PRIVATE },
    );
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
    if (
      error instanceof IcloudCalDavError ||
      error instanceof SecretCryptoError
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: PRIVATE },
      );
    }
    return NextResponse.json(
      { error: "Could not link iCloud Calendar." },
      { status: 502, headers: PRIVATE },
    );
  }
}
