import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

// The agent must know (1) who it is talking to and (2) the current moment at
// any time. The unit tier (tests/agent-context.test.ts) pins the dynamic
// instruction builders; these evals pin that the AGENT actually uses them.
//
// Deterministic first: the harness principal name differs by surface —
// "local-dev" when the eval runner boots the eve runtime directly, "eve user"
// through the app's own local auth (lib/eve-auth.ts) — so the identity gate
// accepts either; what it pins is that the agent REPORTS the session identity
// instead of fabricating one. Today's UTC date is computed fresh, so the time
// gates are exact.
const KNOWN_PRINCIPAL_NAMES = /local-dev|eve\s+user/i;

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
        (text) => KNOWN_PRINCIPAL_NAMES.test(String(text)),
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
