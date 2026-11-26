import { sql } from "drizzle-orm";

import { db } from "@/lib/db/client";

/** Keep at least this many newest events per chat (matches hydrate window). */
const CHAT_EVENT_KEEP = 2_000;
/** Keep this many newest revisions per (chat, path). */
const FILE_REVISION_KEEP = 20;

/**
 * Trim append-only growth: drop old `chat_event` rows beyond the hydrate
 * window and old `agent_file_revision` rows beyond a short history.
 * Idempotent; safe to run from cron.
 */
export async function pruneAppendOnlyChatData(): Promise<{
  readonly eventsDeleted: number;
  readonly revisionsDeleted: number;
}> {
  const eventsResult = await db.execute(sql`
    delete from chat_event e
    using (
      select
        chat_id,
        event_index,
        row_number() over (
          partition by chat_id
          order by event_index desc
        ) as rn
      from chat_event
    ) ranked
    where e.chat_id = ranked.chat_id
      and e.event_index = ranked.event_index
      and ranked.rn > ${CHAT_EVENT_KEEP}
  `);

  const revisionsResult = await db.execute(sql`
    delete from agent_file_revision r
    using (
      select
        chat_id,
        path,
        revision,
        row_number() over (
          partition by chat_id, path
          order by revision desc
        ) as rn
      from agent_file_revision
    ) ranked
    where r.chat_id = ranked.chat_id
      and r.path = ranked.path
      and r.revision = ranked.revision
      and ranked.rn > ${FILE_REVISION_KEEP}
  `);

  return {
    eventsDeleted: rowCount(eventsResult),
    revisionsDeleted: rowCount(revisionsResult),
  };
}

function rowCount(result: unknown): number {
  if (result && typeof result === "object" && "rowCount" in result) {
    const count = (result as { rowCount?: unknown }).rowCount;
    return typeof count === "number" ? count : 0;
  }
  if (Array.isArray(result)) return result.length;
  return 0;
}
