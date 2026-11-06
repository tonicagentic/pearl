/**
 * Mobile copy of identity physical field helpers. Keep in sync with
 * `lib/profile/physical.ts` on the web app.
 */

export type HeightUnit = "imperial" | "metric";
export type WeightUnit = "lb" | "kg";

export type HeightParts = {
  readonly unit: HeightUnit;
  readonly feet: string;
  readonly inches: string;
  readonly cm: string;
};

export type WeightParts = {
  readonly unit: WeightUnit;
  readonly value: string;
};

export type MeasurementParts = {
  readonly chest: string;
  readonly waist: string;
  readonly hips: string;
  readonly inseam: string;
  readonly shoe: string;
  readonly notes: string;
};

export const BUILD_OPTIONS = [
  "Slim",
  "Athletic",
  "Average",
  "Muscular",
  "Stocky",
  "Curvy",
  "Plus",
] as const;

export const GENDER_OPTIONS = [
  "Woman",
  "Man",
  "Non-binary",
  "Prefer not to say",
] as const;

export const EYE_COLOR_OPTIONS = [
  { label: "Brown", swatch: "#6B3F2A" },
  { label: "Hazel", swatch: "#8E6B3A" },
  { label: "Green", swatch: "#3F7A4A" },
  { label: "Blue", swatch: "#4A6FA5" },
  { label: "Gray", swatch: "#7A8490" },
  { label: "Amber", swatch: "#C08A2E" },
] as const;

export const HAIR_COLOR_OPTIONS = [
  { label: "Black", swatch: "#1A1410" },
  { label: "Dark brown", swatch: "#3B2416" },
  { label: "Brown", swatch: "#6B4226" },
  { label: "Auburn", swatch: "#8B3A2A" },
  { label: "Red", swatch: "#B44A2C" },
  { label: "Blonde", swatch: "#D4B46A" },
  { label: "Gray", swatch: "#9A9A9A" },
  { label: "White", swatch: "#F2F0EA" },
] as const;

export const SKIN_TONE_OPTIONS = [
  { label: "Fair", swatch: "#F6E4D4" },
  { label: "Light", swatch: "#E8C7A8" },
  { label: "Medium", swatch: "#C9956C" },
  { label: "Olive", swatch: "#A97B52" },
  { label: "Tan", swatch: "#8B5E3C" },
  { label: "Deep", swatch: "#5C3A24" },
  { label: "Dark", swatch: "#3A2418" },
] as const;

const IMPERIAL_HEIGHT = /^(\d+)\s*'\s*(\d+(?:\.\d+)?)\s*"?\s*$/;
const METRIC_HEIGHT = /^(\d+(?:\.\d+)?)\s*cm$/i;
const WEIGHT = /^(\d+(?:\.\d+)?)\s*(lb|lbs|kg)$/i;

export function parseHeight(stored: string | null | undefined): HeightParts {
  const raw = (stored ?? "").trim();
  if (!raw) {
    return { unit: "imperial", feet: "", inches: "", cm: "" };
  }
  const imperial = IMPERIAL_HEIGHT.exec(raw);
  if (imperial) {
    return {
      unit: "imperial",
      feet: imperial[1] ?? "",
      inches: imperial[2] ?? "",
      cm: "",
    };
  }
  const metric = METRIC_HEIGHT.exec(raw);
  if (metric) {
    return { unit: "metric", feet: "", inches: "", cm: metric[1] ?? "" };
  }
  if (/cm/i.test(raw)) {
    return {
      unit: "metric",
      feet: "",
      inches: "",
      cm: raw.replace(/[^\d.]/g, ""),
    };
  }
  return { unit: "imperial", feet: "", inches: "", cm: "" };
}

export function formatHeight(parts: HeightParts): string {
  if (parts.unit === "metric") {
    const cm = parts.cm.trim();
    return cm ? `${cm} cm` : "";
  }
  const feet = parts.feet.trim();
  const inches = parts.inches.trim() || (feet ? "0" : "");
  if (!feet) return "";
  return `${feet}'${inches}"`;
}

export function parseWeight(stored: string | null | undefined): WeightParts {
  const raw = (stored ?? "").trim();
  if (!raw) return { unit: "lb", value: "" };
  const match = WEIGHT.exec(raw);
  if (match) {
    const unit = (match[2] ?? "lb").toLowerCase().startsWith("kg")
      ? "kg"
      : "lb";
    return { unit, value: match[1] ?? "" };
  }
  return {
    unit: /kg/i.test(raw) ? "kg" : "lb",
    value: raw.replace(/[^\d.]/g, ""),
  };
}

export function formatWeight(parts: WeightParts): string {
  const value = parts.value.trim();
  if (!value) return "";
  return `${value} ${parts.unit}`;
}

const MEASUREMENT_KEYS = [
  "chest",
  "waist",
  "hips",
  "inseam",
  "shoe",
] as const;

export function parseMeasurements(
  stored: string | null | undefined,
): MeasurementParts {
  const empty: MeasurementParts = {
    chest: "",
    waist: "",
    hips: "",
    inseam: "",
    shoe: "",
    notes: "",
  };
  const raw = (stored ?? "").trim();
  if (!raw) return empty;

  const next = { ...empty };
  const leftover: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const match =
      /^\s*(chest|waist|hips|inseam|shoe)\s*:\s*(.+)\s*$/i.exec(line);
    if (!match) {
      if (line.trim()) leftover.push(line.trim());
      continue;
    }
    const key = match[1]!.toLowerCase() as (typeof MEASUREMENT_KEYS)[number];
    next[key] = match[2]!.trim();
  }
  next.notes = leftover.join("\n");
  return next;
}

export function formatMeasurements(parts: MeasurementParts): string {
  const lines: string[] = [];
  for (const key of MEASUREMENT_KEYS) {
    const value = parts[key].trim();
    if (value) {
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      lines.push(`${label}: ${value}`);
    }
  }
  const notes = parts.notes.trim();
  if (notes) lines.push(notes);
  return lines.join("\n");
}

export function optionOrCustom(
  options: readonly string[],
  stored: string | null | undefined,
): { readonly selected: string | null; readonly custom: string } {
  const raw = (stored ?? "").trim();
  if (!raw) return { selected: null, custom: "" };
  const match = options.find(
    (option) => option.toLowerCase() === raw.toLowerCase(),
  );
  if (match) return { selected: match, custom: "" };
  return { selected: "Custom", custom: raw };
}
