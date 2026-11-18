/** Calendar helpers for reusable task-list schedules. */

export const LISTS_TIME_ZONE = "America/Los_Angeles";

export type ListCadence = "daily" | "weekly" | "monthly";

export type ListSchedule = {
  readonly cadence: ListCadence | null;
  /** 0 = Sunday … 6 = Saturday; used when cadence is weekly. */
  readonly weekday: number | null;
  /** 1–28; used when cadence is monthly. */
  readonly monthDay: number | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today as YYYY-MM-DD in the given IANA time zone. */
export function todayInTimeZone(
  timeZone: string = LISTS_TIME_ZONE,
  now: Date = new Date(),
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(`Could not format date in ${timeZone}.`);
  }

  return `${year}-${month}-${day}`;
}

/**
 * Weekday of `now` in the given time zone.
 * 0 = Sunday … 6 = Saturday (matches JS `Date#getUTCDay` numbering).
 */
export function weekdayInTimeZone(
  timeZone: string = LISTS_TIME_ZONE,
  now: Date = new Date(),
): number {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(now);

  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const day = map[label];
  if (day === undefined) {
    throw new Error(`Unexpected weekday label ${label} in ${timeZone}.`);
  }
  return day;
}

/** Day-of-month (1–31) from a YYYY-MM-DD string. */
export function dayOfMonthFromIso(isoDate: string): number {
  if (!ISO_DATE.test(isoDate)) {
    throw new Error(`Expected YYYY-MM-DD, got ${isoDate}.`);
  }
  return Number(isoDate.slice(8, 10));
}

/**
 * Whether a list's schedule should spawn on the given calendar day.
 * Manual lists (`cadence === null`) never match — use an explicit spawn.
 */
export function isScheduleDue(
  schedule: ListSchedule,
  todayIso: string,
  weekday: number,
): boolean {
  if (schedule.cadence === null) {
    return false;
  }

  if (schedule.cadence === "daily") {
    return true;
  }

  if (schedule.cadence === "weekly") {
    return (
      typeof schedule.weekday === "number" &&
      schedule.weekday >= 0 &&
      schedule.weekday <= 6 &&
      schedule.weekday === weekday
    );
  }

  if (schedule.cadence === "monthly") {
    const monthDay = schedule.monthDay;
    if (
      typeof monthDay !== "number" ||
      monthDay < 1 ||
      monthDay > 28
    ) {
      return false;
    }
    return dayOfMonthFromIso(todayIso) === monthDay;
  }

  return false;
}

/**
 * Skip spawning an item when it already has an open issue from this list
 * (missed chores must not pile up), or when this occurrence was already
 * materialized (cron / manual retry safety).
 */
export function shouldSkipSpawnItem(
  itemId: string,
  openItemIds: ReadonlySet<string>,
  spawnedForOccurrence: ReadonlySet<string>,
): boolean {
  return openItemIds.has(itemId) || spawnedForOccurrence.has(itemId);
}

export function formatScheduleSummary(schedule: ListSchedule): string {
  if (schedule.cadence === null) {
    return "Manual";
  }

  if (schedule.cadence === "daily") {
    return "Every day";
  }

  if (schedule.cadence === "weekly") {
    const names = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const name =
      typeof schedule.weekday === "number" &&
      schedule.weekday >= 0 &&
      schedule.weekday <= 6
        ? names[schedule.weekday]
        : null;
    return name ? `Every ${name}` : "Weekly";
  }

  if (schedule.cadence === "monthly") {
    const day = schedule.monthDay;
    if (typeof day !== "number" || day < 1) {
      return "Monthly";
    }
    const suffix =
      day % 10 === 1 && day !== 11
        ? "st"
        : day % 10 === 2 && day !== 12
          ? "nd"
          : day % 10 === 3 && day !== 13
            ? "rd"
            : "th";
    return `Monthly on the ${day}${suffix}`;
  }

  return "Manual";
}
