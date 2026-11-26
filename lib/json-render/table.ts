/** Compact columns stay on one line; longer prose wraps at a readable width. */
export const TABLE_COMPACT_MAX_CHARS = 42;

/**
 * Short numeric / money / percent cells — shrink the column and right-align.
 * Accepts values like `44%`, `1,240`, `$12`, `−3.2`, `12.5k`.
 */
const TABLE_NUMERIC_CELL_RE =
  /^[\$€£]?\s*-?\d{1,3}(?:,\d{3})*(?:\.\d+)?%?[kKmMbBtT]?$|^-?\d+(?:\.\d+)?%$/;

export function isCompactTableColumn(
  header: string,
  rows: readonly (readonly string[])[],
  columnIndex: number,
): boolean {
  if (header.length > TABLE_COMPACT_MAX_CHARS) return false;
  return rows.every((row) => {
    const cell = row[columnIndex] ?? "";
    return cell.length <= TABLE_COMPACT_MAX_CHARS;
  });
}

/** True when every non-empty cell in the column is a short number/percent. */
export function isNumericTableColumn(
  rows: readonly (readonly string[])[],
  columnIndex: number,
): boolean {
  let sawValue = false;
  for (const row of rows) {
    const cell = (row[columnIndex] ?? "").trim();
    if (!cell) continue;
    sawValue = true;
    if (!TABLE_NUMERIC_CELL_RE.test(cell)) return false;
  }
  return sawValue;
}
