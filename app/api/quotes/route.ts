import { NextResponse } from "next/server";

import {
  createLibraryQuote,
  listLibraryQuotes,
} from "@/lib/db/library-quotes";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

async function requireViewer() {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);
  if (!viewer || setupStatus.storageMode !== "database") {
    return null;
  }
  return viewer;
}

export async function GET() {
  const viewer = await requireViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const quotes = await listLibraryQuotes(viewer.id);
  return NextResponse.json({ quotes });
}

export async function POST(request: Request) {
  const viewer = await requireViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    readonly text?: string;
    readonly chatId?: string | null;
    readonly messageId?: string | null;
  };

  try {
    const quote = await createLibraryQuote(viewer.id, {
      text: typeof body.text === "string" ? body.text : "",
      chatId: body.chatId,
      messageId: body.messageId,
    });
    return NextResponse.json({ quote });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save quote.",
      },
      { status: 400 },
    );
  }
}
