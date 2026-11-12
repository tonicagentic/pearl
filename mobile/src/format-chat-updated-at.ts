/** Compact relative time for Recents rows (no external date lib). */
export function formatChatUpdatedAt(
  iso: string,
  nowMs: number = Date.now(),
): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";

  const deltaSec = Math.max(0, Math.round((nowMs - then) / 1000));
  if (deltaSec < 45) return "Just now";
  if (deltaSec < 3600) return `${Math.max(1, Math.round(deltaSec / 60))}m`;
  if (deltaSec < 86_400) return `${Math.max(1, Math.round(deltaSec / 3600))}h`;

  const thenDate = new Date(then);
  const nowDate = new Date(nowMs);
  const startOfToday = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate(),
  ).getTime();
  const startOfThatDay = new Date(
    thenDate.getFullYear(),
    thenDate.getMonth(),
    thenDate.getDate(),
  ).getTime();
  const dayDiff = Math.round((startOfToday - startOfThatDay) / 86_400_000);

  if (dayDiff === 1) return "Yesterday";
  if (dayDiff > 1 && dayDiff < 7) {
    return thenDate.toLocaleDateString(undefined, { weekday: "short" });
  }

  if (thenDate.getFullYear() === nowDate.getFullYear()) {
    return thenDate.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  }

  return thenDate.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
