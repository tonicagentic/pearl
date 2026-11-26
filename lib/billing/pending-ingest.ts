import { inArray } from "drizzle-orm";

import {
  listPendingIngestEvents,
  markUsageEventsIngested,
} from "@/lib/billing/accounts";
import {
  ingestUsageEvents,
  type MetronomeIngestEvent,
} from "@/lib/billing/metronome";
import { microsToUsd } from "@/lib/billing/provider-pricing";
import { db } from "@/lib/db/client";
import { billingAccount } from "@/lib/db/schema";

/**
 * Replay billable usage rows that never got `ingestedAt` (Metronome outage,
 * missing customer at write time, etc.). Idempotent via transaction_id =
 * ledger idempotencyKey.
 */
export async function replayPendingMetronomeIngest(limit = 100): Promise<{
  readonly pending: number;
  readonly ingested: number;
  readonly skipped: number;
}> {
  const pending = await listPendingIngestEvents(limit);
  if (pending.length === 0) {
    return { pending: 0, ingested: 0, skipped: 0 };
  }

  const userIds = [...new Set(pending.map((row) => row.userId))];
  const accounts = await db
    .select({
      userId: billingAccount.userId,
      metronomeCustomerId: billingAccount.metronomeCustomerId,
    })
    .from(billingAccount)
    .where(inArray(billingAccount.userId, userIds));

  const customerByUser = new Map<string, string>();
  for (const row of accounts) {
    if (row.metronomeCustomerId) {
      customerByUser.set(row.userId, row.metronomeCustomerId);
    }
  }

  const events: MetronomeIngestEvent[] = [];
  const eventIds: string[] = [];
  let skipped = 0;

  for (const row of pending) {
    const customerId = customerByUser.get(row.userId);
    if (!customerId) {
      skipped += 1;
      continue;
    }
    events.push({
      transaction_id: row.idempotencyKey,
      customer_id: customerId,
      event_type: "pearl_usage",
      timestamp: row.createdAt.toISOString(),
      properties: {
        source: row.source,
        cost_cents: row.costCents,
        cost_micros: row.costMicros,
        cost_usd: microsToUsd(row.costMicros),
        ...(row.metadata ?? {}),
      },
    });
    eventIds.push(row.id);
  }

  if (events.length === 0) {
    return { pending: pending.length, ingested: 0, skipped };
  }

  const ok = await ingestUsageEvents(events);
  if (!ok) {
    return { pending: pending.length, ingested: 0, skipped };
  }

  await markUsageEventsIngested(eventIds);
  return {
    pending: pending.length,
    ingested: eventIds.length,
    skipped,
  };
}
