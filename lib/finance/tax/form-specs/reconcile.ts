import type { WorkpaperLine } from "../types";
import type { FormLineSpec, YearSpinePack } from "./types";

export type ReconcileFailure = {
  form: string;
  lineId: string;
  kind: FormLineSpec["kind"];
  expectedCents: number;
  actualCents: number;
  deltaCents: number;
  instructionRef?: string;
  message: string;
};

export type ReconcileResult = {
  ok: boolean;
  checked: number;
  failures: ReconcileFailure[];
};

const TOLERANCE_CENTS = 1;

function key(form: string, lineId: string) {
  return `${form}::${lineId}`;
}

/** Index workpaper amounts; duplicate lines last-write-wins. */
export function indexWorkpapers(
  workpapers: WorkpaperLine[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const w of workpapers) {
    map.set(key(w.form, w.line), w.amountCents);
  }
  return map;
}

function amount(
  map: Map<string, number>,
  form: string,
  lineId: string,
): number {
  return map.get(key(form, lineId)) ?? 0;
}

function shouldCheck(
  spec: FormLineSpec,
  map: Map<string, number>,
): boolean {
  if (!spec.requiredWhenLine) return true;
  const cents = amount(
    map,
    spec.requiredWhenLine.form,
    spec.requiredWhenLine.lineId,
  );
  return cents !== 0 || map.has(key(spec.requiredWhenLine.form, spec.requiredWhenLine.lineId));
}

/**
 * Check sum / diff / carry spine specs against workpaper amounts.
 * Missing source lines count as $0. Tolerance: 1¢.
 */
export function reconcileWorkpapers(
  workpapers: WorkpaperLine[],
  pack: YearSpinePack,
): ReconcileResult {
  const map = indexWorkpapers(workpapers);
  const failures: ReconcileFailure[] = [];
  let checked = 0;

  for (const spec of pack.lines) {
    if (spec.kind !== "sum" && spec.kind !== "diff" && spec.kind !== "carry") {
      continue;
    }
    if (!shouldCheck(spec, map)) continue;

    const actual = amount(map, spec.form, spec.lineId);
    // Only check when the target line was emitted (or any source was).
    const targetPresent = map.has(key(spec.form, spec.lineId));
    const sources = spec.sources ?? [];
    const sourceForm = spec.sourceForm ?? spec.form;
    const anySource = sources.some((s) => map.has(key(sourceForm, s)));
    if (!targetPresent && !anySource) continue;

    let expected = 0;
    if (spec.kind === "sum") {
      expected = sources.reduce(
        (s, id) => s + amount(map, sourceForm, id),
        0,
      );
    } else if (spec.kind === "diff") {
      const a = amount(map, sourceForm, sources[0] ?? "");
      const b = amount(map, sourceForm, sources[1] ?? "");
      expected = a - b;
    } else if (spec.kind === "carry") {
      expected = amount(map, sourceForm, sources[0] ?? "");
    }

    checked += 1;
    const delta = actual - expected;
    if (Math.abs(delta) > TOLERANCE_CENTS) {
      failures.push({
        form: spec.form,
        lineId: spec.lineId,
        kind: spec.kind,
        expectedCents: expected,
        actualCents: actual,
        deltaCents: delta,
        instructionRef: spec.instructionRef,
        message: `${spec.form} line ${spec.lineId}: expected ${expected}¢ (${spec.kind}), got ${actual}¢`,
      });
    }
  }

  return { ok: failures.length === 0, checked, failures };
}
