import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Cross-run opener-drift check for the thinking-partner unpack eval.
//
// eve/evals has no dataset-level or post-dataset assertion phase: defineEval
// is one case per file, the runner writes per-run results under
// `.eve/evals/<timestamp>/evals/<id>.json`, and the assertion scopes
// (session/turn) only ever see the current run — so a verbal tic that repeats
// across runs is invisible to a single-run assertion. A native hook would
// belong in the runner's report phase (next to where
// `.eve/evals/<ts>/summary.json` is written) as an afterAll-style dataset
// assertion. Until then, this helper scans the runner's own stored results
// for previous runs of the same eval and compares opening phrases; it runs at
// the end of the eval body, which is the closest point to "after the dataset
// completes" the harness offers.

/** The opening phrase: the reply's first words, normalized for comparison. */
export function openingPhrase(text: string, maxWords = 4): string | null {
  const words = text
    .trim()
    .split(/\s+/)
    .slice(0, maxWords)
    .map((word) => word.toLowerCase().replace(/[^a-zà-ÿ']/g, ""))
    .filter(Boolean);
  if (words.length < 2) return null;
  return words.join(" ");
}

export type OpenerDrift = {
  /** The current run's opening phrase (null when the reply has none). */
  readonly phrase: string | null;
  /** Previous runs of this eval found on disk (empty outputs excluded). */
  readonly pastRuns: number;
  /** Past runs whose opening phrase matches the current run's. */
  readonly matches: number;
  /** Total runs including this one. */
  readonly totalRuns: number;
  /** True when the phrase appears in more than half of the runs (min 3). */
  readonly drifted: boolean;
};

export function openerDrift(
  evalId: string,
  currentReply: string | undefined,
): OpenerDrift {
  const phrase = currentReply ? openingPhrase(currentReply) : null;
  if (phrase === null) {
    return { phrase: null, pastRuns: 0, matches: 0, totalRuns: 1, drifted: false };
  }

  const resultsDir = join(process.cwd(), ".eve", "evals");
  const parts = evalId.split("/");
  let pastRuns = 0;
  let matches = 0;

  let dirs: string[] = [];
  try {
    dirs = readdirSync(resultsDir);
  } catch {
    dirs = [];
  }

  for (const dir of dirs) {
    const file = join(resultsDir, dir, "evals", ...parts, `${parts[parts.length - 1]}.json`);
    try {
      const stored = JSON.parse(readFileSync(file, "utf8")) as {
        result?: { output?: unknown };
      };
      const output = stored?.result?.output;
      if (typeof output !== "string" || output.length === 0) continue;
      pastRuns += 1;
      if (openingPhrase(output) === phrase) matches += 1;
    } catch {
      // Unreadable or partially written result file — skip it.
    }
  }

  const totalRuns = pastRuns + 1;
  // More than half of the runs, with a minimum sample of 3 so two runs can
  // never trigger the flag.
  const drifted = totalRuns >= 3 && matches * 2 > totalRuns;
  return { phrase, pastRuns, matches, totalRuns, drifted };
}
