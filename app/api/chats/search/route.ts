import { NextResponse } from "next/server";
import { searchChatsForUser } from "@/lib/db/queries";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

/** Full chat history search (title + durable event text). */
export async function GET(request: Request) {
  const setupStatus = await getSetupStatus();

  if (!setupStatus.appReady || setupStatus.storageMode !== "database") {
    return NextResponse.json({ chats: [] }, { status: 503 });
  }

  const viewer = await getServerViewer(setupStatus, request.headers);

  if (!viewer) {
    return NextResponse.json({ chats: [] }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json(
      { error: "Query parameter q is required." },
      { status: 400 },
    );
  }

  const chats = await searchChatsForUser(viewer.id, q);
  return NextResponse.json({ chats });
}
