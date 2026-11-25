/** Local calendar day key `YYYY-MM-DD` for day-boundary comparisons. */
export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Day label for a message timestamp relative to `now`.
 * Today / Yesterday / `Nov 24` / `Nov 24, 2025` when the year differs.
 */
export function formatMessageDay(
  date: Date,
  now: Date = new Date(),
): string {
  const dayStart = startOfLocalDay(date).getTime();
  const todayStart = startOfLocalDay(now).getTime();
  const diffDays = Math.round((todayStart - dayStart) / DAY_MS);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}

/** Quiet clock time shown beside a message (`9:12 AM`). */
export function formatMessageTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/**
 * True when this message should render a day rule: no previous visible
 * message, or a different local calendar day than the previous visible one.
 */
export function shouldShowDaySeparator(
  current: Date | undefined,
  previousVisible: Date | undefined,
): boolean {
  if (!(current instanceof Date) || Number.isNaN(current.getTime())) {
    return false;
  }
  if (
    !(previousVisible instanceof Date) ||
    Number.isNaN(previousVisible.getTime())
  ) {
    return true;
  }
  return localDayKey(current) !== localDayKey(previousVisible);
}
