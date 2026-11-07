/** Normalize two share values into flex weights that sum to 100. */
export function comparisonBarShares(
  leftValue: number,
  rightValue: number,
): { left: number; right: number } {
  const left = Number.isFinite(leftValue) ? Math.max(0, leftValue) : 0;
  const right = Number.isFinite(rightValue) ? Math.max(0, rightValue) : 0;
  const total = left + right;
  if (total <= 0) return { left: 50, right: 50 };
  return { left: (left / total) * 100, right: (right / total) * 100 };
}
