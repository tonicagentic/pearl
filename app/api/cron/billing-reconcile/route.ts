import { replayPendingMetronomeIngest } from "@/lib/billing/pending-ingest";
import { reconcileAgedOpenSandboxes } from "@/lib/billing/sandbox-meter";

export const maxDuration = 300;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  return false;
}

async function handle(request: Request) {
  if (!authorizeCron(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [ingest, sandboxes] = await Promise.all([
      replayPendingMetronomeIngest(100),
      reconcileAgedOpenSandboxes(),
    ]);

    return Response.json({
      ok: true,
      ingest,
      sandboxes,
    });
  } catch (err) {
    console.error("[cron/billing-reconcile]", err);
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "Billing reconcile failed",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
