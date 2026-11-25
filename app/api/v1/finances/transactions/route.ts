import {
  buildTransactionsListPayload,
  resolveFinancesTransactionFilters,
} from "@/lib/finance/api-v1-ledger";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { withUserDb } from "@/lib/finance/db";

/** Filtered txn list for Finances Sankey drilldown (web + mobile). */
export async function GET(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;
  return withUserDb(session.user.id, async () => {
    const filters = await resolveFinancesTransactionFilters(
      new URL(request.url).searchParams,
    );
    // Empty categoryIds after group resolve → empty page, not unfiltered month.
    if (
      filters.categoryIds &&
      filters.categoryIds.length === 0 &&
      !filters.inboxOnly
    ) {
      return Response.json({
        items: [],
        nextCursor: null,
        hasMore: false,
        filterOptions: { accounts: [], entities: [], categories: [] },
      });
    }
    const payload = await buildTransactionsListPayload(filters);
    return Response.json(payload);
  });
}
