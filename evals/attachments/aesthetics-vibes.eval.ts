import { readFile } from "node:fs/promises";
import { defineEval } from "eve/evals";

// Aesthetics and vibes: describe the look and feel of each design and answer
// a comparative judgment honestly. Content reading alone is not enough — the
// reply must use aesthetic vocabulary (palette, mood, typography, density).
async function asDataUrl(path: string) {
  const bytes = await readFile(path);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

export default defineEval({
  description:
    "Aesthetics and vibes: characterize the look and feel of two contrasting designs and answer a comparative trust question.",
  tags: ["smoke", "multimodal"],
  timeoutMs: 240_000,
  async test(t) {
    const turn = await t.send([
      {
        type: "text",
        text: "I'm picking a landing page direction. The first screenshot is for Aurora Bank, the second is for NEONX. Describe the vibe of each (palette, mood, typography — not just the text content), then tell me honestly: which one reads as more trustworthy for a bank, and why?",
      },
      {
        type: "file",
        data: await asDataUrl(
          "evals/attachments/fixtures/aesthetic-light.png",
        ),
        mediaType: "image/png",
      },
      {
        type: "file",
        data: await asDataUrl(
          "evals/attachments/fixtures/aesthetic-neon.png",
        ),
        mediaType: "image/png",
      },
    ]);

    turn.expectOk();

    t.judge.autoevals
      .closedQA(
        "The reply describes each design's aesthetic with visual vocabulary: Aurora Bank as minimal/light/calm (light background, serif type, navy/blue tones, restrained) and NEONX as loud/neon/dark (black background, bright green and magenta accents, monospace, hype marketing energy like 100x leverage and 420.69% APY). Describing only the literal text content without aesthetic characterization fails.",
        { on: turn.message },
      )
      .atLeast(0.8);

    t.judge.autoevals
      .closedQA(
        "The comparative judgment is honest and reasonable: the Aurora Bank design reads as more trustworthy for a bank (calm, restrained, conventional banking cues), while NEONX's hype/leverage/no-KYC energy reads as risky or inappropriate for a bank. A wishy-washy 'both are equally trustworthy' answer fails.",
        { on: turn.message },
      )
      .atLeast(0.8);
  },
});
