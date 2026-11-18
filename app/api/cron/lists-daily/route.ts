import {
  listUserIdsWithScheduledLists,
  spawnDueListsForUser,
} from "@/lib/db/lists";

export const maxDuration = 300;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  if (url.searchParams.get("secret") === secret) return true;

  return false;
}

async function handle(request: Request) {
  if (!authorizeCron(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userIds = await listUserIdsWithScheduledLists();
    let lists = 0;
    let created = 0;
    let skipped = 0;

    for (const userId of userIds) {
      const result = await spawnDueListsForUser(userId);
      lists += result.lists;
      created += result.created;
      skipped += result.skipped;
    }

    return Response.json({
      ok: true,
      users: userIds.length,
      lists,
      created,
      skipped,
    });
  } catch (err) {
    console.error("[cron/lists-daily]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Lists daily failed" },
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
