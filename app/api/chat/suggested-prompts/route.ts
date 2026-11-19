import { NextResponse } from "next/server";

import { getSuggestedPromptsForUser } from "@/lib/chat/suggested-prompts-server";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

/**
 * Personalized empty-chat composer chips for the signed-in principal.
 * Grounded in memory, open issues, and recent chat titles; remote-cached
 * until that context fingerprint changes.
 */
export async function GET(request: Request) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus, request.headers);

  if (!viewer || !setupStatus.appReady) {
    return NextResponse.json(
      { error: "Sign in to load suggested prompts." },
      { status: 401 },
    );
  }

  try {
    const prompts = await getSuggestedPromptsForUser({
      authMode: setupStatus.authMode,
      storageMode: setupStatus.storageMode,
      userId: viewer.id,
    });
    return NextResponse.json({ prompts });
  } catch {
    // Empty chat should stay quiet if generation or context loading fails.
    return NextResponse.json({ prompts: [] });
  }
}
