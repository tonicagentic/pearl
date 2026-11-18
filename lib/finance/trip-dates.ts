import {
  addDays,
  eachDayOfInterval,
  format,
  isBefore,
  isSameDay,
  startOfDay,
} from "date-fns";

export const DATE_FLEX_OPTIONS = [0, 1, 2, 3, 7, 14] as const;
export type DateFlexDays = (typeof DATE_FLEX_OPTIONS)[number];

export const DATE_FLEX_LABELS: Record<DateFlexDays, string> = {
  0: "Exact dates",
  1: "± 1 day",
  2: "± 2 days",
  3: "± 3 days",
  7: "± 7 days",
  14: "± 14 days",
};

export type Ymd = string; // yyyy-MM-dd

export function toYmd(d: Date): Ymd {
  return format(d, "yyyy-MM-dd");
}

export function parseYmd(ymd: Ymd): Date {
  const [y, m, day] = ymd.split("-").map(Number);
  return new Date(y!, m! - 1, day!, 12, 0, 0, 0);
}

export function daysAround(center: Ymd, flex: number): Ymd[] {
  const c = parseYmd(center);
  const out: Ymd[] = [];
  for (let i = -flex; i <= flex; i++) {
    out.push(toYmd(addDays(c, i)));
  }
  return out;
}

/** Evenly sample indices including first and last; always includes 0 when present. */
export function sampleEvenly<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  if (max <= 1) return items.slice(0, 1);
  const picked = new Set<number>();
  for (let i = 0; i < max; i++) {
    const idx = Math.round((i * (items.length - 1)) / (max - 1));
    picked.add(idx);
  }
  return [...picked].sort((a, b) => a - b).map((i) => items[i]!);
}

export type RoundTripDatePair = { out: Ymd; ret: Ymd };

/**
 * Build round-trip (out, ret) pairs within ±flex of planned dates.
 * Always includes the exact center. Caps at maxPairs via even sampling.
 */
export function flexRoundTripPairs(
  start: Ymd,
  end: Ymd,
  flex: number,
  maxPairs = 25,
): RoundTripDatePair[] {
  const outs = daysAround(start, flex);
  const rets = daysAround(end, flex);
  const pairs: RoundTripDatePair[] = [];
  for (const out of outs) {
    for (const ret of rets) {
      if (out < ret) pairs.push({ out, ret });
    }
  }
  // Ensure exact center is first so sampling keeps it when possible
  const exactIdx = pairs.findIndex((p) => p.out === start && p.ret === end);
  if (exactIdx > 0) {
    const [exact] = pairs.splice(exactIdx, 1);
    pairs.unshift(exact!);
  }
  return sampleEvenly(pairs, maxPairs);
}

export type MultiCitySliceDates = { dates: Ymd[] };

/**
 * Multi-city: expand only first and last slice dates by ±flex; middle fixed.
 * Returns list of full date arrays (one date per slice), capped at maxCombos.
 */
export function flexMultiCityDateCombos(
  sliceDates: Ymd[],
  flex: number,
  maxCombos = 25,
): Ymd[][] {
  if (sliceDates.length === 0) return [];
  if (sliceDates.length === 1) {
    return daysAround(sliceDates[0]!, flex)
      .slice(0, maxCombos)
      .map((d) => [d]);
  }

  const firstOpts = daysAround(sliceDates[0]!, flex);
  const lastOpts = daysAround(sliceDates[sliceDates.length - 1]!, flex);
  const middle = sliceDates.slice(1, -1);
  const combos: Ymd[][] = [];

  for (const first of firstOpts) {
    for (const last of lastOpts) {
      const dates = [first, ...middle, last];
      let ok = true;
      for (let i = 1; i < dates.length; i++) {
        if (dates[i]! <= dates[i - 1]!) {
          ok = false;
          break;
        }
      }
      if (ok) combos.push(dates);
    }
  }

  const exactKey = sliceDates.join("|");
  const exactIdx = combos.findIndex((c) => c.join("|") === exactKey);
  if (exactIdx > 0) {
    const [exact] = combos.splice(exactIdx, 1);
    combos.unshift(exact!);
  }
  return sampleEvenly(combos, maxCombos);
}

/** Stay check-in/out windows within ±flex (cap ~5), always including exact. */
export function flexStayWindows(
  checkIn: Ymd,
  checkOut: Ymd,
  flex: number,
  maxWindows = 5,
): { checkIn: Ymd; checkOut: Ymd }[] {
  const nights =
    (parseYmd(checkOut).getTime() - parseYmd(checkIn).getTime()) /
    (1000 * 60 * 60 * 24);
  if (nights <= 0) return [{ checkIn, checkOut }];

  const shifts: number[] = [0];
  for (let i = 1; i <= flex && shifts.length < maxWindows; i++) {
    shifts.push(-i);
    if (shifts.length < maxWindows) shifts.push(i);
  }

  const windows = shifts.map((s) => ({
    checkIn: toYmd(addDays(parseYmd(checkIn), s)),
    checkOut: toYmd(addDays(parseYmd(checkOut), s)),
  }));
  return sampleEvenly(windows, maxWindows);
}

export function calendarMonthMatrix(year: number, monthIndex: number): (Date | null)[][] {
  const first = new Date(year, monthIndex, 1, 12);
  const startPad = first.getDay(); // 0 Sun
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, monthIndex, d, 12));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

export function isInRange(day: Date, start: Date | null, end: Date | null): boolean {
  if (!start || !end) return false;
  const t = startOfDay(day).getTime();
  const a = startOfDay(start).getTime();
  const b = startOfDay(end).getTime();
  return t >= Math.min(a, b) && t <= Math.max(a, b);
}

export function isRangeEndpoint(day: Date, start: Date | null, end: Date | null): boolean {
  if (start && isSameDay(day, start)) return true;
  if (end && isSameDay(day, end)) return true;
  return false;
}

export function rangeNights(start: Date | null, end: Date | null): number | null {
  if (!start || !end) return null;
  if (isBefore(end, start)) return null;
  return eachDayOfInterval({ start, end }).length - 1;
}
