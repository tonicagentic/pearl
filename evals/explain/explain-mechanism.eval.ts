import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“Explain how X works” — get a clear mechanism explanation without fabricated sources.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    const turn = await t.send(
      "Explain how a JWT access token works end-to-end — issue, send, verify — " +
        "for a curious engineer. Keep it concrete (claims, signature, expiry). " +
        "Do not invent citations or papers. Prefer the thread over a long file " +
        "unless you need one.",
    );

    t.succeeded();
    turn.notCalledTool("exa_agent_run");

    t.judge(
        "The reply explains JWT access tokens as a mechanism: how a token is " +
          "issued, carried on requests, and verified (signature / claims / " +
          "expiry). It stays concrete and educational, does not invent named " +
          "papers or URLs as sources, and is readable in the thread (or a short " +
          "file note) without dumping unrelated product marketing.",
        { on: turn.reply },
      )
      .label("explain-mechanism")
      .atLeast(0.8);
  },
});
