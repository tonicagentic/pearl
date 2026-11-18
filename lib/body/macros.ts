export type MacroTotals = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type MacroLine = {
  servings: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export const EMPTY_MACROS: MacroTotals = {
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
};

function n(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Scale per-serving macros by servings (rounded to 2 decimals). */
export function scaleMacros(
  perServing: Omit<MacroLine, "servings">,
  servings: number,
): MacroTotals {
  const s = n(servings);
  return {
    calories: round2(n(perServing.calories) * s),
    proteinG: round2(n(perServing.proteinG) * s),
    carbsG: round2(n(perServing.carbsG) * s),
    fatG: round2(n(perServing.fatG) * s),
  };
}

/** Sum macro lines (already scaled). */
export function sumMacros(lines: MacroTotals[]): MacroTotals {
  return lines.reduce(
    (acc, line) => ({
      calories: round2(acc.calories + n(line.calories)),
      proteinG: round2(acc.proteinG + n(line.proteinG)),
      carbsG: round2(acc.carbsG + n(line.carbsG)),
      fatG: round2(acc.fatG + n(line.fatG)),
    }),
    { ...EMPTY_MACROS },
  );
}

/** Remaining = target − logged (can be negative). */
export function remainingMacros(
  target: MacroTotals,
  logged: MacroTotals,
): MacroTotals {
  return {
    calories: round2(n(target.calories) - n(logged.calories)),
    proteinG: round2(n(target.proteinG) - n(logged.proteinG)),
    carbsG: round2(n(target.carbsG) - n(logged.carbsG)),
    fatG: round2(n(target.fatG) - n(logged.fatG)),
  };
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function macrosFromNumeric(row: {
  calories: string | number;
  proteinG: string | number;
  carbsG: string | number;
  fatG: string | number;
}): MacroTotals {
  return {
    calories: n(row.calories),
    proteinG: n(row.proteinG),
    carbsG: n(row.carbsG),
    fatG: n(row.fatG),
  };
}
