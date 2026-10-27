import {
  deleteTokenCacheEntry,
  revokeToken,
} from "@vercel/connect";
import { NextResponse } from "next/server";
import {
  connectionConfiguration,
  connectionSubjectForUser,
  isConnectionId,
} from "@/lib/connections/catalog";
import { checkConnectionStatus } from "@/lib/connections/status";
import { RateLimitError, enforceRateLimit } from "@/lib/rate-limit";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

const PRIVATE = { "Cache-Control": "private, no-store" };

/** Revoke this user's Connect grant for one connector and drop the local cache. */
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
  const viewer = await getServerViewer(setup);
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
    id?: unknown;
  } | null;
  if (!isConnectionId(body?.id)) {
    return NextResponse.json(
      { error: "Unknown connection." },
      { status: 400, headers: PRIVATE },
    );
  }
  const config = connectionConfiguration(body.id);
  if (!config.connector) {
    return NextResponse.json(
      { error: "Connection is not available." },
      { status: 409, headers: PRIVATE },
    );
  }
  const subject = connectionSubjectForUser(viewer.id);
  try {
    await enforceRateLimit({
      key: viewer.id,
      prefix: "connect-revoke",
      limit: 12,
      windowSeconds: 300,
    });
    await revokeToken(config.connector, { subject });
    deleteTokenCacheEntry(config.connector, { subject });
    return NextResponse.json(
      {
        connection: await checkConnectionStatus(body.id, viewer.id, true),
      },
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
    return NextResponse.json(
      { error: "Could not disconnect. Try again in a moment." },
      { status: 502, headers: PRIVATE },
    );
  }
}
