import { NextResponse } from "next/server";

import {
  listUserRepos,
  parsePageParam,
  parsePerPageParam,
} from "@/lib/repos/github-repos";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

/** Authenticated, paginated list of the viewer's GitHub repos (web + mobile). */
export async function GET(request: Request) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;

  try {
    const result = await listUserRepos({
      userId: viewer.id,
      page: parsePageParam(params.get("page")),
      perPage: parsePerPageParam(params.get("per_page")),
    });
    return NextResponse.json(result);
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "Failed to load repos." },
      { status: 502 },
    );
  }
}
