import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

// A finished surface draft gets a fresh-context surface review delegated to
// the reviewer subagent, which loads the surface rubric itself and returns a
// structured verdict. This pins the delegation and the ack; the verdict's
// quality lands in the background-run notification on the follow-up turn.
export default defineEval({
  description:
    "Surface review delegation: a finished blog draft is delegated to the reviewer subagent with the surface named, and the thread says what is being reviewed and what comes back.",
  tags: ["smoke"],
  async test(t) {
    const turn = await t.send(
      `I finished this blog post draft. Run your review pass on it before I publish:\n\n## What nobody tells you about running your own infra\n\nEveryone said running our own Postgres would be a nightmare. For the first\nthree months it was boring. Backups ran, failover worked, and the pager was\nquiet. The nightmare everyone warns about never showed up — what showed up\ninstead was a slower, cheaper, more understandable system that we could tune\nto our actual workload. This post is about the three decisions that made the\ndifference: owning the failover story, boring hardware, and a replica we were\nnot afraid to reboot.`,
    );

    t.succeeded();
    t.calledTool("reviewer");

    const reply = turn.message ?? "";
    t.check(
      reply.length,
      satisfies((length: number) => length > 80, "the thread explains the review handoff"),
    );

    t.judge.autoevals
      .closedQA(
        "The thread makes the handoff legible: it says the draft is being reviewed (by the reviewer/editor pass), what the review covers, and that the findings land in this thread when it finishes — so the wait is not silent. It does not claim the review already ran, and it does not paste a full review that was never produced.",
        { on: reply },
      )
      .atLeast(0.8);
  },
});
