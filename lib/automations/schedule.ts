import type {
  AutomationScheduleExpression,
  PearlAutomationTriggerConfig,
  PearlAutomationTriggerKind,
} from "./types.ts";

const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local wall-clock parts for `now` in an IANA timezone. */
export function localParts(
  timeZone: string,
  now: Date = new Date(),
): {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly weekday: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekday = weekdayMap[get("weekday")];
  if (weekday === undefined) {
    throw new Error(`Unexpected weekday in ${timeZone}.`);
  }

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday,
  };
}

function formatClock(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? "AM" : "PM";
  return `${h12}:${pad2(minute)} ${suffix}`;
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function formatMonthDay(month: number, day: number): string {
  const label = MONTH_LABELS[month - 1] ?? `Month ${month}`;
  return `${label} ${ordinal(day)}`;
}

/**
 * Fill missing trigger fields from "now" in the given timezone so the UI and
 * eve expression share the same defaults (current clock, 9–17 for hourly, …).
 */
export function normalizeTriggerConfig(
  kind: PearlAutomationTriggerKind,
  config: PearlAutomationTriggerConfig | undefined,
  timeZone: string,
  now: Date = new Date(),
): PearlAutomationTriggerConfig {
  const local = localParts(timeZone, now);
  const hour = clampInt(config?.hour, 0, 23, local.hour);
  const minute = clampInt(config?.minute, 0, 59, local.minute);

  switch (kind) {
    case "once": {
      const runAt =
        typeof config?.runAt === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(config.runAt)
          ? config.runAt
          : `${local.year}-${pad2(local.month)}-${pad2(local.day)}T${pad2(hour)}:${pad2(minute)}`;
      return { runAt, hour, minute };
    }
    case "hourly":
      return {
        minute: clampInt(config?.minute, 0, 59, 0),
        startHour: clampInt(config?.startHour, 0, 23, 9),
        endHour: clampInt(config?.endHour, 0, 23, 17),
      };
    case "daily":
      return { hour, minute };
    case "weekdays":
      return { hour, minute };
    case "weekly":
      return {
        hour,
        minute,
        weekday: clampInt(config?.weekday, 0, 6, local.weekday),
      };
    case "monthly":
      return {
        hour,
        minute,
        dayOfMonth: clampInt(config?.dayOfMonth, 1, 28, 1),
      };
    case "annually":
      return {
        hour,
        minute,
        month: clampInt(config?.month, 1, 12, local.month),
        dayOfMonth: clampInt(config?.dayOfMonth, 1, 28, local.day),
      };
  }
}

/** Map a friendly trigger to an eve ScheduleExpression. */
export function toScheduleExpression(
  kind: PearlAutomationTriggerKind,
  config: PearlAutomationTriggerConfig | undefined,
  timeZone: string,
  now: Date = new Date(),
): AutomationScheduleExpression {
  const c = normalizeTriggerConfig(kind, config, timeZone, now);
  const tz = timeZone.trim() || "UTC";

  switch (kind) {
    case "once": {
      const at = c.runAt!;
      return { type: "single", at, timezone: tz };
    }
    case "hourly": {
      const minute = c.minute ?? 0;
      const start = c.startHour ?? 9;
      const end = c.endHour ?? 17;
      const hours =
        start <= end ? `${start}-${end}` : `${start}-23,0-${end}`;
      return {
        type: "cron",
        cron: `${minute} ${hours} * * *`,
        timezone: tz,
      };
    }
    case "daily":
      return {
        type: "cron",
        cron: `${c.minute} ${c.hour} * * *`,
        timezone: tz,
      };
    case "weekdays":
      return {
        type: "cron",
        cron: `${c.minute} ${c.hour} * * 1-5`,
        timezone: tz,
      };
    case "weekly":
      return {
        type: "cron",
        cron: `${c.minute} ${c.hour} * * ${c.weekday}`,
        timezone: tz,
      };
    case "monthly":
      return {
        type: "cron",
        cron: `${c.minute} ${c.hour} ${c.dayOfMonth} * *`,
        timezone: tz,
      };
    case "annually":
      return {
        type: "cron",
        cron: `${c.minute} ${c.hour} ${c.dayOfMonth} ${c.month} *`,
        timezone: tz,
      };
  }
}

/** Human-readable subtitle for list rows and the trigger picker. */
export function formatScheduleSummary(
  kind: PearlAutomationTriggerKind,
  config: PearlAutomationTriggerConfig | undefined,
  timeZone: string,
  now: Date = new Date(),
): string {
  const c = normalizeTriggerConfig(kind, config, timeZone, now);

  switch (kind) {
    case "once": {
      const at = c.runAt!;
      const [datePart, timePart] = at.split("T");
      const [y, m, d] = datePart.split("-").map(Number);
      const [hh, mm] = timePart.split(":").map(Number);
      const monthLabel = MONTH_LABELS[(m ?? 1) - 1] ?? "Unknown";
      return `Only one time on ${monthLabel} ${d}, ${y} at ${formatClock(hh, mm)}`;
    }
    case "hourly": {
      const start = c.startHour ?? 9;
      const end = c.endHour ?? 17;
      return `Every hour from ${formatClock(start, 0)} to ${formatClock(end, 0)}`;
    }
    case "daily":
      return `Every day at ${formatClock(c.hour!, c.minute!)}`;
    case "weekdays":
      return `Every weekday at ${formatClock(c.hour!, c.minute!)}`;
    case "weekly": {
      const day = WEEKDAY_LABELS[c.weekday ?? 0] ?? "Sunday";
      return `Every week on ${day} at ${formatClock(c.hour!, c.minute!)}`;
    }
    case "monthly":
      return `On the ${ordinal(c.dayOfMonth ?? 1)} of each month at ${formatClock(c.hour!, c.minute!)}`;
    case "annually":
      return `Every year on ${formatMonthDay(c.month ?? 1, c.dayOfMonth ?? 1)} at ${formatClock(c.hour!, c.minute!)}`;
  }
}

/** Short picker labels matching the Grok-style General sheet. */
export function triggerKindLabel(kind: PearlAutomationTriggerKind): string {
  switch (kind) {
    case "once":
      return "Once";
    case "hourly":
      return "Hourly";
    case "daily":
      return "Daily";
    case "weekdays":
      return "Weekdays";
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
    case "annually":
      return "Annually";
  }
}
