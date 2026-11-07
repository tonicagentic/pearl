import { NextResponse } from "next/server";

import { describeLiveTokenError, mintLiveToken } from "@/lib/live-token";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

// Mobile live mode. Realtime client secrets require AI_GATEWAY_API_KEY
// (OIDC alone is rejected by the Gateway). The token never stays on the server.
export async function POST() {
  const setupStatus = await getSetupStatus();
  if (!setupStatus.appReady) {
    return NextResponse.json({ error: "App is not ready." }, { status: 503, ...NO_STORE });
  }

  const viewer = await getServerViewer(setupStatus);
  if (!viewer) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401, ...NO_STORE });
  }

  try {
    const secret = await mintLiveToken();
    return NextResponse.json(secret, NO_STORE);
  } catch (error) {
    return NextResponse.json(
      { error: describeLiveTokenError(error) },
      { status: 502, ...NO_STORE },
    );
  }
}
