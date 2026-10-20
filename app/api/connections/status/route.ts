import { NextResponse } from "next/server";
import { connectionConfiguration, isConnectionId } from "@/lib/connections/catalog";
import { checkConnectionStatus, listConnectionStatuses } from "@/lib/connections/status";
import { RateLimitError, enforceRateLimit } from "@/lib/rate-limit";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

const PRIVATE = { "Cache-Control": "private, no-store" };

export async function GET() {
  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup);
  if (!viewer) return NextResponse.json({ error: "Sign in required." }, { status: 401, headers: PRIVATE });
  const personal = setup.authMode === "email" || setup.authMode === "vercel";
  const connections = await listConnectionStatuses(personal ? viewer.id : undefined);
  return NextResponse.json({ connections }, { headers: PRIVATE });
}

export async function POST(request: Request) {
  // Browser cookies must not be usable for a cross-origin status request.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Origin not allowed." }, { status: 403, headers: PRIVATE });
  }
  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup);
  if (!viewer) return NextResponse.json({ error: "Sign in required." }, { status: 401, headers: PRIVATE });
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  if (!isConnectionId(body?.id)) {
    return NextResponse.json({ error: "Unknown connection." }, { status: 400, headers: PRIVATE });
  }
  if (setup.authMode !== "email" && setup.authMode !== "vercel") {
    return NextResponse.json({
      connection: {
        id: body.id,
        label: connectionConfiguration(body.id).label,
        status: "unknown",
        detail: "Individual authorization requires a personal sign-in.",
      },
    }, { headers: PRIVATE });
  }
  try {
    await enforceRateLimit({ key: viewer.id, prefix: "connect-status", limit: 30, windowSeconds: 300 });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, {
        status: 429, headers: { ...PRIVATE, "Retry-After": String(error.retryAfter) },
      });
    }
    return NextResponse.json({ error: "Could not check connection status." }, { status: 503, headers: PRIVATE });
  }
  return NextResponse.json({ connection: await checkConnectionStatus(body.id, viewer.id, true) }, { headers: PRIVATE });
}
