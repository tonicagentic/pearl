import { NextResponse } from "next/server";

import {
  listAllUserRepos,
  listUserRepos,
  parsePageParam,
  parsePerPageParam,
} from "@/lib/repos/github-repos";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

const PRIVATE = { "Cache-Control": "private, no-store" };

/** Authenticated, paginated list of the viewer's GitHub repos (web + mobile). */
export async function GET(request: Request) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus, request.headers);

  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in required." },
      { status: 401, headers: PRIVATE },
    );
  }

  const params = new URL(request.url).searchParams;
  const all =
    params.get("all") === "1" ||
    params.get("all") === "true" ||
    params.get("all") === "yes";

  try {
    if (all) {
      const result = await listAllUserRepos({ userId: viewer.id });
      return NextResponse.json(result, { headers: PRIVATE });
    }

    const result = await listUserRepos({
      userId: viewer.id,
      page: parsePageParam(params.get("page")),
      perPage: parsePerPageParam(params.get("per_page")),
    });
    return NextResponse.json(result, { headers: PRIVATE });
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "Failed to load repos." },
      { status: 502, headers: PRIVATE },
    );
  }
}
