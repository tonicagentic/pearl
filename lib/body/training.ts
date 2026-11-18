export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Parse training_days JSON text into a sorted unique list of weekdays 0–6. */
export function parseTrainingDays(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const days = parsed
      .map((d) => (typeof d === "number" ? d : Number(d)))
      .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    return [...new Set(days)].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export function serializeTrainingDays(days: number[]): string {
  const cleaned = [
    ...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)),
  ].sort((a, b) => a - b);
  return JSON.stringify(cleaned);
}

/** Weekday for a YYYY-MM-DD date (UTC noon to avoid DST edge cases). */
export function weekdayFromDate(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`Invalid date: ${isoDate}`);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

export function isTrainingDay(
  trainingDays: number[] | string | null | undefined,
  weekdayOrDate: number | string,
): boolean {
  const days =
    typeof trainingDays === "string" || trainingDays == null
      ? parseTrainingDays(trainingDays)
      : trainingDays;
  const weekday =
    typeof weekdayOrDate === "string"
      ? weekdayFromDate(weekdayOrDate)
      : weekdayOrDate;
  return days.includes(weekday);
}
