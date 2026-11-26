import { NextResponse } from "next/server";

import { assertChatMessageLength } from "@/lib/chat/limits";
import { RateLimitError, enforceRateLimit } from "@/lib/rate-limit";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

const SEND_LIMIT = 25;
const SEND_WINDOW_SECONDS = 60 * 60;

/** Mobile/web REST parity for prepareSend rate limits (Bearer-safe). */
export async function POST(request: Request) {
  const setupStatus = await getSetupStatus();
  if (!setupStatus.appReady || setupStatus.storageMode !== "database") {
    return NextResponse.json({ allowed: true as const });
  }

  const viewer = await getServerViewer(setupStatus, request.headers);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    readonly message?: unknown;
  };
  const message =
    typeof body.message === "string" ? body.message : undefined;

  try {
    if (message) {
      assertChatMessageLength(message);
    }
    await enforceRateLimit({
      key: viewer.id,
      limit: SEND_LIMIT,
      prefix: "chat:send",
      windowSeconds: SEND_WINDOW_SECONDS,
    });
    return NextResponse.json({ allowed: true as const });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({
        allowed: false as const,
        message: error.message,
        retryAfter: error.retryAfter,
      });
    }
    throw error;
  }
}
