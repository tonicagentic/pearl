import type { YearFormBindings } from "./types";
import { bindings2025 } from "./2025";
import { bindings2026 } from "./2026";

const BY_YEAR: Record<number, YearFormBindings> = {
  2025: bindings2025,
  2024: { ...bindings2025, year: 2024 },
  2026: bindings2026,
};

export function loadYearBindings(year: number): YearFormBindings | null {
  return BY_YEAR[year] ?? BY_YEAR[2025] ?? null;
}

export type { YearFormBindings, FormBindings, BindingValue } from "./types";
export { bindings2025, bindings2026 };
export {
  assertBindingsCoverSpecs,
  assertBindingsInInventory,
  loadInventoriesFromDisk,
} from "./assert";