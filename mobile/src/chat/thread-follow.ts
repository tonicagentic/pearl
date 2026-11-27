/**
 * Scroll offset that pins the list end without eating the glass-header inset
 * on a short thread. When the content below `topInset` still fits in the
 * viewport, stay at 0 so the first bubble rests under the header. Longer
 * threads return the classic end offset so older lines can fade under glass.
 */
export function followEndOffset({
  contentHeight,
  viewportHeight,
  topInset,
}: {
  readonly contentHeight: number;
  readonly viewportHeight: number;
  readonly topInset: number;
}): number {
  if (viewportHeight <= 0) return 0;
  const belowInset = contentHeight - topInset;
  if (belowInset <= viewportHeight) return 0;
  return contentHeight - viewportHeight;
}
