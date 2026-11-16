/**
 * Mobile copy of plan preference helpers. Keep in sync with
 * `lib/profile/plan.ts` on the web app.
 */

export type PlanPreferenceParts = {
  readonly airport: string;
  readonly seat: string;
  readonly cabin: string;
  readonly airlines: string;
  readonly hotels: string;
  readonly horizon: string;
  readonly depth: string;
  readonly notes: string;
};

const PLAN_KEYS = [
  ["airport", "Home airport"],
  ["seat", "Seat"],
  ["cabin", "Cabin"],
  ["airlines", "Airlines"],
  ["hotels", "Hotels"],
  ["horizon", "Horizon"],
  ["depth", "Depth"],
] as const;

const LABEL_TO_KEY = new Map(
  PLAN_KEYS.map(([key, label]) => [label.toLowerCase(), key]),
);

export const NO_PREFERENCE = "No preference";

export const SEAT_OPTIONS = [NO_PREFERENCE, "Window", "Aisle"] as const;

export const CABIN_OPTIONS = [
  NO_PREFERENCE,
  "Economy",
  "Premium economy",
  "Business",
  "First",
] as const;

export const HORIZON_OPTIONS = [
  NO_PREFERENCE,
  "This week",
  "This month",
  "This quarter",
  "This year",
] as const;

export const DEPTH_OPTIONS = [
  NO_PREFERENCE,
  "Outline",
  "Full written plan",
] as const;

export function emptyPlanPreferences(): PlanPreferenceParts {
  return {
    airport: "",
    seat: "",
    cabin: "",
    airlines: "",
    hotels: "",
    horizon: "",
    depth: "",
    notes: "",
  };
}

export function parsePlanPreferences(
  stored: string | null | undefined,
): PlanPreferenceParts {
  const next = emptyPlanPreferences();
  const raw = (stored ?? "").trim();
  if (!raw) return next;

  const leftover: string[] = [];
  const mutable: { -readonly [K in keyof PlanPreferenceParts]: string } = {
    ...next,
  };
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([^:]+)\s*:\s*(.+)\s*$/.exec(line);
    const key = match
      ? LABEL_TO_KEY.get(match[1]!.trim().toLowerCase())
      : undefined;
    if (!key || !match) {
      if (line.trim()) leftover.push(line.trim());
      continue;
    }
    mutable[key] = match[2]!.trim();
  }
  mutable.notes = leftover.join("\n");
  return mutable;
}

export function formatPlanPreferences(parts: PlanPreferenceParts): string {
  const lines: string[] = [];
  for (const [key, label] of PLAN_KEYS) {
    const value = parts[key].trim();
    if (value && value !== NO_PREFERENCE) lines.push(`${label}: ${value}`);
  }
  const notes = parts.notes.trim();
  if (notes) lines.push(notes);
  return lines.join("\n");
}

export function pickerValue(stored: string): string {
  return stored.trim() || NO_PREFERENCE;
}
