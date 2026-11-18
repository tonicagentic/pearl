import { spine2025 } from "./2025/spine";
import type { YearSpinePack } from "./types";

const BY_YEAR: Record<number, YearSpinePack> = {
  2025: spine2025,
  2024: { ...spine2025, year: 2024 },
  2026: { ...spine2025, year: 2026 },
};

export function loadSpinePack(year: number): YearSpinePack | null {
  return BY_YEAR[year] ?? BY_YEAR[2025] ?? null;
}

export function spineForms(year: number): string[] {
  return loadSpinePack(year)?.forms ?? [];
}

export type { FormLineSpec, FormLineKind, YearSpinePack } from "./types";
export {
  reconcileWorkpapers,
  indexWorkpapers,
  type ReconcileFailure,
  type ReconcileResult,
} from "./reconcile";
export { spine2025 };
