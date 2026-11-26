import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "Finished design packs (App Store assets, social posts, product shots) → delegate to designer; art-direction-only stays off designer.",
  tags: ["smoke", "costs-image"],
  timeoutMs: 420_000,
  async test(t) {
    const cases = [
      {
        name: "app-store-assets",
        prompt:
          "I need a full iOS App Store asset pack for Pearl: a 1024×1024 " +
          "app icon plus three iPhone marketing stills for the store listing. " +
          "Produce the finished files.",
        judge:
          "The thread starts finished App Store asset work via designer " +
          "(delegates / says the designer is starting). It does not invent " +
          "App Store Connect or CDN image URLs as already uploaded.",
      },
      {
        name: "social-posts",
        prompt:
          "Make LinkedIn (1200×627) and X/Twitter launch graphics for Pearl's " +
          "mobile app — finished post-ready images at those sizes.",
        judge:
          "The thread starts social graphic production via designer " +
          "(delegates / says the designer is starting). It does not invent " +
          "hosted social CDN URLs that no tool returned.",
      },
      {
        name: "product-shot-set",
        prompt:
          "Create a set of three catalog product photos of a matte black " +
          "wireless earbud case on white — finished generate_image shots for " +
          "our landing page.",
        judge:
          "The thread starts a finished product-shot pack via designer " +
          "(delegates / says the designer is starting). It does not invent " +
          "image URLs that were not produced by a tool.",
      },
    ] as const;

    for (const testCase of cases) {
      const session = await t.session();
      const turn = await session.send(testCase.prompt);

      t.succeeded();
      turn.calledTool("designer");
      turn.noFailedCalls();

      t.judge(testCase.judge, { on: turn.reply })
        .label(testCase.name)
        .atLeast(0.8);
    }
  },
});
