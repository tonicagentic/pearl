import { NextResponse } from "next/server";
import { suggestPlaces } from "@/lib/finance/duffel";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";

export async function GET(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || searchParams.get("name") || "").trim();
  if (!q) {
    return NextResponse.json({ places: [] });
  }
  if (q.length < 2 && !/^[A-Za-z]{3}$/.test(q)) {
    return NextResponse.json({ places: [] });
  }

  try {
    const places = await suggestPlaces(q, 8);
    return NextResponse.json({ places });
  } catch (e) {
    return NextResponse.json(
      {
        places: [],
        error: e instanceof Error ? e.message : "Place search failed",
      },
      { status: 500 },
    );
  }
}
