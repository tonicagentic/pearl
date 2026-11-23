import { NextResponse } from "next/server";

import { handleAppleNotification } from "@/lib/billing/apple";

/**
 * App Store Server Notifications V2.
 * Configure in App Store Connect → App → App Store Server Notifications.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { signedPayload?: unknown };
    if (typeof body.signedPayload !== "string" || !body.signedPayload.trim()) {
      return NextResponse.json(
        { error: "signedPayload is required." },
        { status: 400 },
      );
    }

    await handleAppleNotification(body.signedPayload.trim());
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[billing/apple/notifications]", error);
    return NextResponse.json(
      { error: "Could not process Apple notification." },
      { status: 400 },
    );
  }
}
