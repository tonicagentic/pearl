import { NextResponse } from "next/server";
import { toSpokenTurns, type LiveSpokenDraft } from "@/lib/chat/spoken-turns";
import { getChatForUser, saveSpokenTurnsForUser } from "@/lib/db/queries";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export async function PUT(
  request: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
) {
  const setupStatus = await getSetupStatus();

  if (!setupStatus.appReady || setupStatus.storageMode !== "database") {
    return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  }

  const viewer = await getServerViewer(setupStatus);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getChatForUser(id, viewer.id);
  if (!existing) {
    return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as {
    readonly turns?: readonly LiveSpokenDraft[];
  } | null;

  if (!body || !Array.isArray(body.turns)) {
    return NextResponse.json({ error: "Provide turns." }, { status: 400 });
  }

  const drafts = body.turns.filter(
    (turn): turn is LiveSpokenDraft =>
      turn != null &&
      typeof turn === "object" &&
      (turn.role === "user" || turn.role === "pearl") &&
      typeof turn.text === "string",
  );
  const spokenTurns = toSpokenTurns(id, drafts);
  if (spokenTurns.length === 0) {
    return NextResponse.json({ error: "No spoken lines to save." }, { status: 400 });
  }

  const ok = await saveSpokenTurnsForUser({
    chatId: id,
    userId: viewer.id,
    turns: spokenTurns,
  });
  if (!ok) {
    return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  }

  return NextResponse.json({ spokenTurns });
}
