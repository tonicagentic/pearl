import { defineEval } from "eve/evals";

// The file-artifact exception: a sentence-or-two snippet stays in chat. The
// agent should not spin up a file artifact for a quick line edit — the
// snippet regime is what keeps quick conversational edits fast.
export default defineEval({
  description:
    "Snippet exception: a one-sentence line edit is answered inline in chat, without creating a file artifact.",
  tags: ["smoke"],
  async test(t) {
    const turn = await t.send(
      'Rewrite this one sentence to be active voice, nothing else: "It was decided by the team that the deadline would be moved."',
    );

    t.succeeded();
    t.usedNoTools();

    t.judge.autoevals
      .closedQA(
        "The reply contains a single active-voice rewrite of the sentence (the team decided to move the deadline, or equivalent), with no file creation, no commentary, and no extra content.",
        { on: turn.message },
      )
      .atLeast(0.8);
  },
});
