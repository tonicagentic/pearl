import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

// The agent must know (1) who it is talking to and (2) the current moment at
// any time. The unit tier (tests/agent-context.test.ts) pins the dynamic
// instruction builders; these evals pin that the AGENT actually uses them.
//
// Deterministic first: the local dev principal name (lib/eve-auth.ts local
// fallback) and today's UTC date are known values, so both identity and the
// date are asserted without a judge. A judge gate covers the reasoning probe
// (does the agent reason FROM the injected timestamp rather than guessing).

const LOCAL_DEV_USER_NAME = "eve user";

export default defineEval({
  description:
    "Identity and time awareness: the agent knows who it is talking to and the current date/time at any moment.",
  tags: ["reliability", "smoke"],
  timeoutMs: 240_000,
  async test(t) {
    // Identity: asked directly, the agent states who it is talking to.
    const identity = await t.send(
      "Who am I — do you know who you're talking to? Answer with the name you have for me.",
    );
    t.succeeded();

    t.check(
      identity.message ?? "",
      satisfies(
        (text) => /eve\s+user/i.test(String(text)),
        "the reply names the signed-in user from the session identity",
      ),
    );

    // Time: asked directly, the agent gives the current date — not a
    // training-prior guess.
    const now = new Date();
    const todayUtc = now.toISOString().slice(0, 10);
    const time = await t.send(
      "What is today's date (UTC)? Answer with the exact date you have.",
    );
    t.succeeded();

    t.check(
      time.message ?? "",
      satisfies(
        (text) => String(text).includes(todayUtc),
        `the reply states today's date (${todayUtc}) from the injected clock, not a guess`,
      ),
    );

    // Time-sensitive reasoning: the agent must reason FROM the current
    // timestamp (deadline math), not fabricate.
    const reasoning = await t.send(
      "A report is due in 3 days. On what calendar date (UTC) does it land? Answer with the exact date.",
    );
    t.succeeded();

    const due = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    t.check(
      reasoning.message ?? "",
      satisfies(
        (text) => String(text).includes(due),
        `the reply computes the deadline from the current date (${due})`,
      ),
    );

    // The identity answer must not fabricate a different person.
    t.judge.autoevals
      .closedQA(
        "The reply identifies the caller from the session identity without inventing a different name, account, or personal details.",
        { on: identity.message ?? "" },
      )
      .atLeast(0.8);
  },
});
