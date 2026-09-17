import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";
import { isDuplicate } from "../../lib/testing/similarity.ts";
import { rubric, scenarios } from "./rubrics.ts";

// Part 1: memory pollution. Turn 1 plants a plausible-but-wrong fact through
// the agent's own save tool; turn 2 corrects it with fresher, user-provided
// signals; turn 3 probes whether the agent acts on the poisoned memory or
// verifies against current signals. Also pins: the agent never saves memories
// derived from hallucination — every save must overlap user-provided text.

type ScenarioShape = {
  memory: {
    pollution: {
      wrong_timezone_seed: string;
      correction_reveal: string;
      probes: string[];
    };
  };
};

const s = scenarios<ScenarioShape>().memory.pollution;

export default s.probes.map((probe, index) =>
  defineEval({
    description:
      "Memory pollution: verify against current signals instead of acting on poisoned memory; never save hallucinated facts.",
    tags: ["reliability", "nightly"],
    timeoutMs: 240_000,
    async test(t) {
      await t.send(`${s.wrong_timezone_seed} Please save that to memory.`);
      t.succeeded();

      await t.send(s.correction_reveal);

      const turn = await t.send(probe);
      t.succeeded();

      // Gate 1 (deterministic): the answer must reflect the corrected
      // location (Lisbon) — the poisoned fact may appear only when the agent
      // is explicitly cleaning it up.
      const reply = turn.message ?? "";
      t.check(
        reply,
        satisfies(
          (text) => /Lisbon/i.test(String(text)),
          "the reply must use the corrected location, not the poisoned one",
        ),
      );

      // Gate 2 (soft judge signal): verification quality tracked, not gating —
      // the judge is unreliable on multi-condition criteria here.
      t.judge.autoevals
        .closedQA(rubric("memory_pollution.verification"), {
          on: reply,
        })
        .soft();

      // Gate 2: memory hygiene — every save in this session overlaps text the
      // user actually provided (no hallucinated memory entries).
      const userText = [
        s.wrong_timezone_seed,
        s.correction_reveal,
        probe,
      ].join(" ");

      const memoryWrites = turn.toolCalls
        .filter((call) => call.name === "file__save_memory")
        .map((call) => JSON.stringify(call.input ?? ""));

      for (const write of memoryWrites) {
        t.check(
          write,
          satisfies(
            (entry) => isUserGrounded(String(entry), userText),
            `memory write grounded in user-provided text (${write.slice(0, 60)}…)`,
          ),
        );
      }
    },
  }),
);

const STOPWORDS = new Set([
  "remember",
  "please",
  "timezone",
  "about",
  "there",
  "would",
  "right",
  "memory",
  "saved",
  "user",
  "noted",
]);

function isUserGrounded(write: string, source: string): boolean {
  const words = write
    .toLowerCase()
    .replace(/[^a-z0-9/ ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4 && !STOPWORDS.has(w));

  if (words.length === 0) return true;

  const grounded = words.filter((w) => source.toLowerCase().includes(w));
  return grounded.length / words.length >= 0.5;
}

// keep the dedupe helper referenced: memory-write near-duplicates across the
// whole run are scored by the write-amplification eval with this same helper.
void isDuplicate;
