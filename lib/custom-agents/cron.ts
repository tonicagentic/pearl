/**
 * Minimal 5-field cron matcher for custom-agent routines.
 * Fields: minute hour day-of-month month day-of-week (0=Sunday).
 */

function parseField(
  field: string,
  min: number,
  max: number,
): (value: number) => boolean {
  if (field === "*") return () => true;

  const allowed = new Set<number>();
  for (const part of field.split(",")) {
    const stepMatch = /^(\*|\d+-\d+)\/(\d+)$/.exec(part);
    if (stepMatch) {
      const [, range, stepRaw] = stepMatch;
      const step = Number(stepRaw);
      let start = min;
      let end = max;
      if (range !== "*") {
        const [a, b] = range.split("-").map(Number);
        start = a;
        end = b;
      }
      for (let i = start; i <= end; i += step) allowed.add(i);
      continue;
    }
    const rangeMatch = /^(\d+)-(\d+)$/.exec(part);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      for (let i = start; i <= end; i++) allowed.add(i);
      continue;
    }
    allowed.add(Number(part));
  }
  return (value) => allowed.has(value);
}

export function cronMatches(
  expression: string,
  date: Date,
  timeZone: string,
): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    minute: "numeric",
    hour: "numeric",
    day: "numeric",
    month: "numeric",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);

  const minute = Number(parts.find((p) => p.type === "minute")?.value);
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const weekdayLabel = parts.find((p) => p.type === "weekday")?.value ?? "";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekday = weekdayMap[weekdayLabel];
  if (
    !Number.isFinite(minute) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(day) ||
    !Number.isFinite(month) ||
    weekday === undefined
  ) {
    return false;
  }

  const [minF, hourF, dayF, monthF, weekF] = fields;
  return (
    parseField(minF, 0, 59)(minute) &&
    parseField(hourF, 0, 23)(hour) &&
    parseField(dayF, 1, 31)(day) &&
    parseField(monthF, 1, 12)(month) &&
    parseField(weekF, 0, 6)(weekday)
  );
}

/** True when due in this 15-minute dispatcher window and not already run in it. */
export function routineDueInWindow(input: {
  readonly cron: string;
  readonly timezone: string;
  readonly lastRunAt: Date | null;
  readonly now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  if (!cronMatches(input.cron, now, input.timezone)) return false;
  if (!input.lastRunAt) return true;
  // Skip if already claimed in the last 14 minutes (dispatcher cadence).
  return now.getTime() - input.lastRunAt.getTime() >= 14 * 60 * 1000;
}
