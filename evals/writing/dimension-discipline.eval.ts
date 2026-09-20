import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";
import { artifactMaterial, threadDoesNotRepeatArtifact } from "./file-assertions.ts";

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
    "Dimension discipline: change only the requested dimension (register) on an already-good draft; generic polish that alters structure or content fails. Written works are file artifacts.",
  tags: ["smoke"],
  async test(t) {
    const turn = await t.send(
      `I'm drafting a blog post about our migration — this paragraph is part of it. It's way too stiff. Make it sound casual and human — that's the only change I want, keep the content and length about the same:\n\n${FORMAL_DRAFT}`,
    );

    t.succeeded();
    t.calledTool("write_file");

    const fileContent = artifactMaterial(turn);
    t.check(
      fileContent.length,
      satisfies((length: number) => length > 150, "the edited draft was written to a file artifact"),
    );
    t.check(
      threadDoesNotRepeatArtifact(turn, artifactMaterial(turn)),
      satisfies(Boolean, "the thread reply stays shorter than the artifact"),
    );

    t.judge.autoevals
      .closedQA(
        "The rewrite reads casual and human (contractions, plain words, natural sentence rhythm) where the original was stiff and formal.",
        { on: fileContent },
      )
      .atLeast(0.8);

    t.judge.autoevals
      .closedQA(
        "Only the register changed: the rewrite preserves the same facts in the same order (migration done, finished 40 minutes early, verification scripts/counts/checksums clean, services stayed up, monitor errors 72 hours, summary to wiki), roughly similar length, and adds no headers, bullets, or new content.",
        { on: fileContent },
      )
      .atLeast(0.8);
  },
});
