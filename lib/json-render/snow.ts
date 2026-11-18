/** Shared labels/colors for SnowReport trail difficulty levels. */

export type SnowTrailLevelId =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "expert";

export const SNOW_TRAIL_LEVELS: readonly {
  readonly id: SnowTrailLevelId;
  readonly label: string;
  /** Classic ski-map mark color. */
  readonly color: string;
  readonly symbol: "circle" | "square" | "diamond" | "double-diamond";
}[] = [
  { id: "beginner", label: "Green", color: "#22C55E", symbol: "circle" },
  { id: "intermediate", label: "Blue", color: "#3B82F6", symbol: "square" },
  { id: "advanced", label: "Black", color: "#111111", symbol: "diamond" },
  {
    id: "expert",
    label: "Double black",
    color: "#111111",
    symbol: "double-diamond",
  },
] as const;

export function snowTrailLevelMeta(level: string) {
  return (
    SNOW_TRAIL_LEVELS.find((entry) => entry.id === level) ?? {
      id: level as SnowTrailLevelId,
      label: level,
      color: "#737373",
      symbol: "circle" as const,
    }
  );
}

export function formatSnowLevelCount(
  open: number,
  total: number | null | undefined,
): string {
  if (total == null || !Number.isFinite(total)) return String(open);
  return `${open} / ${total}`;
}
