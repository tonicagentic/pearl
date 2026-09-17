import { defineEval } from "eve/evals";
import { rubric, scenarios } from "./rubrics.ts";

// Part 1: stale memory. The stored fact carries an explicit old-date marker;
// the agent must qualify it as possibly outdated and re-confirm before the
// user relies on it.
//
// Architecture gap (documented in evals/README.md): eve's fileMemory entries
// carry no timestamps, so a storage-enforced staleness threshold is not
// possible today — this eval pins the behavioral contract instead.

type ScenarioShape = {
  memory: {
    stale: { old_seed: string; old_probe: string };
  };
};

const s = scenarios<ScenarioShape>().memory.stale;

export default defineEval({
  description:
    "Stale memory: re-confirm before the user acts on entries older than the threshold (behavioral; no storage-level timestamps exist).",
  tags: ["reliability", "nightly"],
  timeoutMs: 240_000,
  async test(t) {
    await t.send(`${s.old_seed}`);
    t.succeeded();

    const turn = await t.send(s.old_probe);
    t.succeeded();

    t.judge.autoevals
      .closedQA(rubric("stale_memory.reconfirm"), { on: turn.message })
      .atLeast(0.8);
  },
});
