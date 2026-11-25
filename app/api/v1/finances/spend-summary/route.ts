import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { getMonthSpendSummaryCached } from "@/lib/finance/spend-cache";
import { currentYearMonth } from "@/lib/finance/money";

function parseYearMonth(searchParams: URLSearchParams) {
  const now = currentYearMonth();
  const yearRaw = Number(searchParams.get("year"));
  const monthRaw = Number(searchParams.get("month"));
  const year =
    Number.isFinite(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100
      ? Math.trunc(yearRaw)
      : now.year;
  const month =
    Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12
      ? Math.trunc(monthRaw)
      : now.month;
  return { year, month };
}

/** Lean month spend rollup for Pearl Finances (web + mobile). */
export async function GET(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;

  const { year, month } = parseYearMonth(new URL(request.url).searchParams);
  const summary = await getMonthSpendSummaryCached(
    session.user.id,
    year,
    month,
  );
  return Response.json(summary);
}
