import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";
import { isDuplicate } from "../../lib/testing/similarity.ts";

// Part 1: write amplification. A scripted session walks through distinct
// topics; every file__save_memory call is collected and scored with the
// dedupe helper (exact + normalized + near-duplicate). No duplicate or
// near-duplicate entries may accumulate.
//
// Turn count is configurable: 12 by default (CI/nightly budget), 50 via
// EVAL_WRITE_AMP_TURNS for the full scripted sweep.

const TURNS: readonly string[] = [
  "Remember: my timezone is Pacific/Auckland.",
  "Remember: I prefer brief emails with no sign-off.",
  "Remember: my laptop is a MacBook Pro 16-inch for work.",
  "Reminder for memory: my timezone is Pacific/Auckland.", // near-dup of turn 1
  "Remember: I prefer short emails without sign-offs.", // paraphrase of turn 2
  "Remember: my editor is Neovim and I use the Tokyo Night theme.",
  "Please note down: my standup is at 9:30am on weekdays.",
  "Save this: I take notes in plain markdown, never Notion.",
  "Remember that my backup drive is encrypted with LUKS.",
  "Please remember: my desk setup uses a 34-inch ultrawide monitor.",
  "Remember that my preferred repo host is GitHub, not GitLab.",
  "Please remember: my timezone is Pacific/Auckland, that's where I am.", // near-dup of turn 1
  "Save: my keyboard is a 65% mechanical board with brown switches.",
  "Remember: I review PRs in the morning, not the evening.",
];

const turnLimit = Number(process.env.EVAL_WRITE_AMP_TURNS ?? 12);

export default defineEval({
  description:
    "Write amplification: scripted turns produce no duplicate or near-duplicate memory entries (exact + normalized + near-dup dedupe).",
  tags: ["reliability", "nightly"],
  timeoutMs: 600_000,
  async test(t) {
    const scripted = TURNS.slice(0, Number(process.env.EVAL_WRITE_AMP_TURNS ?? TURNS.length));

    const writes: string[] = [];

    for (const message of scripted) {
      const turn = await t.send(message);
      t.succeeded();

      for (const call of turn.toolCalls) {
        if (call.name !== "file__save_memory") continue;
        const write = JSON.stringify(call.input ?? "");

        // The contract under test: a save that duplicates or near-duplicates
        // an existing entry must not create a new ledger entry.
        t.check(
          write,
          satisfies(
            (entry) => !isDuplicate(String(entry), writes),
            `no duplicate/near-duplicate memory write (${write.slice(0, 80)}…)`,
          ),
        );
        writes.push(write);
      }
    }

    t.log(`scripted turns: ${scripted.length}; memory writes: ${writes.length}`);
    t.succeeded();
  },
});
