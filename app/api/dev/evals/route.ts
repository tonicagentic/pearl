import { NextResponse } from "next/server";

import {
  listEvalRuns,
  loadEvalDetail,
} from "@/lib/dev/eval-artifacts";
import {
  loadEvalCatalog,
  loadEvalCatalogAgents,
} from "@/lib/dev/eval-catalog";
import { loadToolsCatalog } from "@/lib/dev/eval-tools-catalog";

/**
 * Dev-only JSON for the /dev/evals browser.
 * GET /api/dev/evals                 → recent runs
 * GET /api/dev/evals?catalog=1       → agents + suite/eval/assertion catalog from sources
 * GET /api/dev/evals?tools=1         → per-agent tool surface + eval gate coverage
 * GET /api/dev/evals?run=ID          → one run summary
 * GET /api/dev/evals?run=ID&id=…     → one eval detail
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const url = new URL(request.url);
  const runId = url.searchParams.get("run");
  const evalId = url.searchParams.get("id");
  const catalog = url.searchParams.get("catalog");
  const tools = url.searchParams.get("tools");

  try {
    if (tools === "1" || tools === "true") {
      return NextResponse.json({ agents: loadToolsCatalog() });
    }

    if (catalog === "1" || catalog === "true") {
      const agents = loadEvalCatalogAgents();
      return NextResponse.json({
        agents,
        suites: loadEvalCatalog(),
      });
    }

    if (runId && evalId) {
      const detail = loadEvalDetail(runId, evalId);
      if (!detail) {
        return NextResponse.json({ error: "Eval not found" }, { status: 404 });
      }
      return NextResponse.json(detail);
    }

    const runs = listEvalRuns(60);
    if (runId) {
      const run = runs.find((item) => item.id === runId);
      if (!run) {
        return NextResponse.json({ error: "Run not found" }, { status: 404 });
      }
      return NextResponse.json(run);
    }

    return NextResponse.json({ runs });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read eval artifacts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
