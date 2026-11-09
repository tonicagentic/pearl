import { readFile } from "node:fs/promises";
import { defineEval } from "eve/evals";
import { seedPdfAttachment } from "./helpers.ts";

// Scanned-PDF routing through the paged read_attachment flow: the scanned
// fixture has no text layer (the seed stores it with pdfType Scanned), the
// composer-style message says it could not be read, and the agent must
// respond gracefully instead of fabricating contents.
export default defineEval({
  description:
    "Scanned PDF routing: the agent responds gracefully when an attached scanned PDF could not be read, instead of fabricating contents.",
  tags: ["smoke", "multimodal"],
  timeoutMs: 240_000,
  async test(t) {
    const session = await t.session();
    await session.send("Hello! One moment please.");

    const sessionId = session.id;

    const seeded = await seedPdfAttachment(
      "evals/attachments/fixtures/scanned-compliance.pdf",
      sessionId,
    );

    const turn = await session.send(
      `I scanned our compliance summary and attached it (attachment ${seeded.attachmentId}). What is the retention schedule and who approved it?`,
    );

    turn.expectOk();

    t.judge(
        "The reply acknowledges that the attached scanned PDF cannot be read (no text layer / OCR is not supported), and either asks the user for the details in another form or offers alternatives (e.g., typing out the relevant section). It must NOT fabricate a retention schedule or an approver.",
        { on: turn.reply },
      )
      .atLeast(0.8);
  },
});
