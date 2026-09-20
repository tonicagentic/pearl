import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";
import { artifactMaterial, threadDoesNotRepeatArtifact } from "./file-assertions.ts";

// A draft with a strong, distinctive author voice. Tightening must not
// sand the voice off into generic corporate prose.
const VOICEY_DRAFT = `Okay so, confession time: I spent three days debugging the
flakiest test suite known to humankind, and the villain of the story turned
out to be — wait for it — a timezone. Not a race condition, not a flaky
network, not even an off-by-one. A timezone. Our little integration test
suite runs at midnight UTC and asserts "today's" revenue, which is a
perfectly reasonable thing to assert until your CI box decides that midnight
UTC is yesterday. I have feelings about this. The fix was two lines. Two.
Lines. After three days. I'm not saying I want those days back, but I want
them acknowledged.`;

export default defineEval({
  description:
    "Preserve voice: tighten a draft by roughly a third without sanding off the author's distinctive voice.",
  tags: ["smoke"],
  async test(t) {
    const turn = await t.send(
      `Tighten this up by about a third — cut the fat, keep my voice. It's the opening of a blog post I'm writing, and it's supposed to sound like me, not like a press release:\n\n${VOICEY_DRAFT}`,
    );

    t.succeeded();
    t.calledTool("write_file");

    const fileContent = artifactMaterial(turn);
    t.check(
      fileContent.length,
      satisfies((length: number) => length > 100, "the edited draft was written to a file artifact"),
    );
    t.check(
      threadDoesNotRepeatArtifact(turn, artifactMaterial(turn)),
      satisfies(Boolean, "the thread reply stays shorter than the artifact"),
    );

    t.judge.autoevals
      .closedQA(
        "The tightened version keeps the author's distinctive voice: conversational and self-deprecating with personality (the reveal framing, direct asides to the reader, the emphatic 'Two. Lines.' beat, the wry ending asking for acknowledgement). A flat, generic corporate summary of the same events fails.",
        { on: fileContent },
      )
      .atLeast(0.8);

    t.judge.autoevals
      .closedQA(
        "The tightened version is genuinely shorter than the original (roughly a third less) while keeping all the key story beats: three days of debugging, the culprit was a timezone (not a race condition or off-by-one), the midnight-UTC-vs-yesterday mechanism, the two-line fix.",
        { on: fileContent },
      )
      .atLeast(0.8);
  },
});
