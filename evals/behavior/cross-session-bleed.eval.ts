import { defineEval } from "eve/evals";
import { rubric, scenarios } from "./rubrics.ts";

// Part 1: cross-session bleed. State seeded in session A (an elaborate plan,
// then discarded) must not be resurrected in session B. Memory is shared
// per-principal by design — the pin is that ephemeral task details never
// become standing memory (agent/instructions.md forbids saving current-task
// details).

type ScenarioShape = {
  memory: {
    bleed: { plan_seed: string; discard: string; bleed_probe: string };
  };
};

const s = scenarios<ScenarioShape>().memory.bleed;

export default defineEval({
  description:
    "Cross-session bleed: a plan discarded in session A is not resurrected in session B.",
  tags: ["reliability", "nightly"],
  timeoutMs: 240_000,
  async test(t) {
    await t.send(s.plan_seed);
    t.succeeded();

    await t.send(s.discard);
    t.succeeded();

    const sessionB = await t.newSession();
    const turn = await sessionB.send(s.bleed_probe);
    t.succeeded();

    t.judge.autoevals
      .closedQA(rubric("cross_session_bleed.no_resurrection"), {
        on: turn.message,
      })
      .atLeast(0.8);
  },
});
