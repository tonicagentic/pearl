/** Pure helpers for Chart answer cards (assistant-ui-style sparkline). */

export type ChartTrend = "up" | "down" | "flat";
export type ChartVariant = "area" | "line" | "bars";

export function inferChartTrend(
  delta: string | null | undefined,
  trend: ChartTrend | null | undefined,
): ChartTrend {
  if (trend === "up" || trend === "down" || trend === "flat") return trend;
  if (!delta) return "flat";
  const trimmed = delta.trim();
  if (!trimmed) return "flat";
  if (/^[\-−–]/.test(trimmed)) return "down";
  const digits = trimmed.replace(/[^\d.]/g, "");
  if (digits.length > 0 && Number(digits) === 0) return "flat";
  return "up";
}

export function chartDeltaTone(
  trend: ChartTrend,
  upIsGood: boolean | null | undefined,
): "positive" | "negative" | "neutral" {
  if (trend === "flat") return "neutral";
  const goodIsUp = upIsGood !== false;
  if (trend === "up") return goodIsUp ? "positive" : "negative";
  return goodIsUp ? "negative" : "positive";
}

export function clampVisibleCount(
  pointsLength: number,
  visibleCount: number | null | undefined,
): number {
  if (pointsLength <= 0) return 0;
  if (visibleCount == null || !Number.isFinite(visibleCount)) {
    return pointsLength;
  }
  return Math.max(1, Math.min(pointsLength, Math.floor(visibleCount)));
}

export type ChartPoint = { readonly x: number; readonly y: number };

/** Map the first `count` points into a 0…width × 0…height viewBox (y grows down). */
export function chartSeriesLayout(
  points: readonly number[],
  count: number,
  width = 240,
  height = 72,
  pad = 4,
): {
  readonly visible: readonly ChartPoint[];
  readonly linePath: string;
  readonly areaPath: string;
  readonly bars: readonly { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly last: boolean }[];
} {
  const visibleValues = points.slice(0, Math.max(0, count));
  if (visibleValues.length === 0) {
    return { visible: [], linePath: "", areaPath: "", bars: [] };
  }

  const min = Math.min(...visibleValues);
  const max = Math.max(...visibleValues);
  const span = max - min || 1;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const n = visibleValues.length;

  const visible: ChartPoint[] = visibleValues.map((value, index) => {
    const x =
      n === 1 ? pad + innerW / 2 : pad + (index / (n - 1)) * innerW;
    const y = pad + (1 - (value - min) / span) * innerH;
    return { x, y };
  });

  const linePath = visible
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  const first = visible[0]!;
  const last = visible[visible.length - 1]!;
  const areaPath =
    linePath +
    ` L${last.x.toFixed(2)} ${(pad + innerH).toFixed(2)} L${first.x.toFixed(2)} ${(pad + innerH).toFixed(2)} Z`;

  const gap = 2;
  const barW = n === 0 ? 0 : Math.max(2, (innerW - gap * Math.max(0, n - 1)) / n);
  const bars = visibleValues.map((value, index) => {
    const h = ((value - min) / span) * innerH;
    const x = pad + index * (barW + gap);
    const y = pad + innerH - h;
    return { x, y, w: barW, h: Math.max(h, 1), last: index === n - 1 };
  });

  return { visible, linePath, areaPath, bars };
}
