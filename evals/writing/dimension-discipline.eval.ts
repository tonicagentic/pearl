import { defineEval } from "eve/evals";

// A draft that is already well structured and correct — the only requested
// change is register. Generic polish (adding headers, bulleting everything,
// expanding) would violate the request.
const FORMAL_DRAFT = `We have completed the migration of all customer data to the new
storage region. The maintenance window closed approximately forty minutes
ahead of schedule. Verification scripts confirmed record counts and checksums
across every migrated table, and no discrepancies were identified. Customer
facing services remained available throughout the process. We will monitor
error rates over the next seventy-two hours and publish a summary of the
operation to the internal wiki.`;

export default defineEval({
  description:
    "Dimension discipline: change only the requested dimension (register) on an already-good draft; generic polish that alters structure or content fails.",
  tags: ["smoke"],
  async test(t) {
    const turn = await t.send(
      `This is fine but way too stiff. Make it sound casual and human — that's the only change I want, keep the content and length about the same:\n\n${FORMAL_DRAFT}`,
    );

    t.succeeded();
    t.usedNoTools();

    t.judge.autoevals
      .closedQA(
        "The rewrite reads casual and human (contractions, plain words, natural sentence rhythm) where the original was stiff and formal.",
        { on: turn.message },
      )
      .atLeast(0.8);

    t.judge.autoevals
      .closedQA(
        "Only the register changed: the rewrite preserves the same facts in the same order (migration done, finished 40 minutes early, verification scripts/counts/checksums clean, services stayed up, monitor errors 72 hours, summary to wiki), roughly similar length, and adds no headers, bullets, or new content.",
        { on: turn.message },
      )
      .atLeast(0.8);
  },
});
