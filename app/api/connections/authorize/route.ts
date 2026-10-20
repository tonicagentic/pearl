import { getConnectorMetadata, startAuthorization } from "@vercel/connect";
import { NextResponse } from "next/server";
import { connectionConfiguration, connectionSubjectForUser, isConnectionId } from "@/lib/connections/catalog";
import { RateLimitError, enforceRateLimit } from "@/lib/rate-limit";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

const PRIVATE = { "Cache-Control": "private, no-store" };

/** Explicit per-user OAuth start. Connect owns encrypted grants and the OAuth
 * callback; neither this route nor the clients store provider credentials. */
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const browserOrigin = request.headers.get("origin");
  if (browserOrigin && browserOrigin !== origin) {
    return NextResponse.json({ error: "Origin not allowed." }, { status: 403, headers: PRIVATE });
  }
  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup);
  if (!viewer) return NextResponse.json({ error: "Sign in required." }, { status: 401, headers: PRIVATE });
  if (setup.authMode !== "email" && setup.authMode !== "vercel") {
    return NextResponse.json({ error: "A personal account is required." }, { status: 403, headers: PRIVATE });
  }
  const body = (await request.json().catch(() => null)) as { id?: unknown; deviceCode?: unknown } | null;
  if (!isConnectionId(body?.id)) {
    return NextResponse.json({ error: "Unknown connection." }, { status: 400, headers: PRIVATE });
  }
  const config = connectionConfiguration(body.id);
  if (!config.connector) {
    return NextResponse.json({ error: "Connection is not available." }, { status: 409, headers: PRIVATE });
  }
  try {
    await enforceRateLimit({ key: viewer.id, prefix: "connect-authorize", limit: 12, windowSeconds: 300 });
    // Fail before prompting if the connector is not attached in this environment.
    await getConnectorMetadata(config.connector);
    const challenge = await startAuthorization(config.connector, {
      subject: connectionSubjectForUser(viewer.id),
    }, {
      callbackUrl: `${origin}/settings/connections/return`,
      // Browser redirects need no code; native may request a device code while
      // opening an external browser without a registered app callback scheme.
      deviceCode: body.deviceCode === true,
    });
    const url = new URL(challenge.url);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
      throw new Error("Connect returned an unsafe authorization URL.");
    }
    return NextResponse.json({
      url: url.href,
      ...(challenge.deviceCode ? { userCode: challenge.deviceCode } : {}),
    }, { headers: PRIVATE });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, {
        status: 429, headers: { ...PRIVATE, "Retry-After": String(error.retryAfter) },
      });
    }
    // Connect errors can contain vendor tokens or IDs. Never reflect them to clients.
    return NextResponse.json({ error: "Could not start authorization. Check connector setup and try again." }, {
      status: 502, headers: PRIVATE,
    });
  }
}
