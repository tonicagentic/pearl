import { pruneAppendOnlyChatData } from "@/lib/db/retention";

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
    const pruned = await pruneAppendOnlyChatData();
    return Response.json({ ok: true, pruned });
  } catch (err) {
    console.error("[cron/data-retention]", err);
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "Data retention failed",
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
