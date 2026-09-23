/**
 * Arrow-notation density check for the house style rule on arrows.
 *
 * @remarks
 * The house rule (`agent/skills/house-style.md`, the
 * `public-editorial-voice` skill, and the shared `ai-phrases-to-avoid`
 * reference) reserves arrow notation (`→`) for diagrams, equations, compact
 * process models, and intentionally schematic passages. Prose expresses state
 * changes as transformations ("from X to Y", "X becomes Y", or a precise
 * transformation verb), and tables use separate Initial state / Desired state
 * columns. The lint enforces this as a density check rather than a ban: one
 * deliberately schematic passage is fine; arrows sprinkled through prose or
 * table rows are not.
 *
 * Kept dependency-free so both the `lint_against_style` tool and unit tests
 * can import it without pulling in the eve runtime or generated modules.
 */

/**
 * Maximum number of separate arrow-bearing lines allowed outside fenced code
 * blocks before arrows read as default punctuation rather than notation.
 *
 * @remarks
 * One deliberately schematic passage (a compact process model on a single
 * line) stays under this bound; arrows sprinkled across prose or table rows
 * cross it.
 */
export const MAX_ARROW_LINES = 3;

/**
 * Count lines that use arrow notation (`→`) outside fenced code blocks.
 *
 * @remarks
 * Fenced code blocks are excluded so ASCII diagrams and equations never
 * count. Table rows are not excluded on purpose: the house convention asks
 * for `Initial state` / `Desired state` columns instead of arrows in table
 * cells.
 *
 * @param text - Draft text to scan.
 * @returns The number of arrow-bearing lines outside fenced code blocks.
 */
export function arrowLineCount(text: string): number {
  let inFence = false;
  let count = 0;
  for (const line of text.split("\n")) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && line.includes("→")) {
      count += 1;
    }
  }
  return count;
}
