import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“Explain how X works” / “Explain how Adderall helps ADHD” / “Explain the Riemann hypothesis” — get a clear mechanism explanation without fabricated sources.",
  tags: ["smoke"],
  timeoutMs: 240_000,
  async test(t) {
    // Case: JWT mechanism
    // description: User asks how JWT access tokens work end-to-end. Agent explains issue/send/verify concretely without invented citations.
    const jwt = await t.session();
    const jwtTurn = await jwt.send(
      "Explain how a JWT access token works end-to-end — issue, send, verify — " +
        "for a curious engineer. Keep it concrete (claims, signature, expiry). " +
        "Do not invent citations or papers. Prefer the thread over a long file " +
        "unless you need one.",
    );

    t.succeeded();
    jwtTurn.notCalledTool("exa_agent_run");

    t.judge(
        "The reply explains JWT access tokens as a mechanism: how a token is " +
          "issued, carried on requests, and verified (signature / claims / " +
          "expiry). It stays concrete and educational, does not invent named " +
          "papers or URLs as sources, and is readable in the thread (or a short " +
          "file note) without dumping unrelated product marketing.",
        { on: jwtTurn.reply },
      )
      .label("explain-mechanism")
      .atLeast(0.8);

    // Case: Adderall / ADHD mechanism
    // description: User asks how Adderall helps ADHD. Agent explains the mechanism clearly; no fabricated papers or medical claims as settled fact from invented sources.
    const adderall = await t.session();
    const adderallTurn = await adderall.send(
      "Explain how Adderall helps ADHD",
    );

    t.succeeded();
    adderallTurn.notCalledTool("exa_agent_run");

    t.judge(
        "The reply explains how Adderall (amphetamine stimulants) relates to ADHD " +
          "as a mechanism — e.g. effects on dopamine and/or norepinephrine and how " +
          "that can improve attention or executive symptoms — in clear educational " +
          "language. It does not invent named papers, studies, or URLs as sources. " +
          "It stays explanatory rather than prescribing a personal treatment plan.",
        { on: adderallTurn.reply },
      )
      .label("adderall-adhd-mechanism")
      .atLeast(0.8);

    // Case: Riemann hypothesis
    // description: User asks to explain the Riemann hypothesis. Agent gives a clear conceptual explanation; no fabricated papers or proofs.
    const riemann = await t.session();
    const riemannTurn = await riemann.send("Explain the Riemann hypothesis");

    t.succeeded();
    riemannTurn.notCalledTool("exa_agent_run");

    t.judge(
        "The reply explains the Riemann hypothesis in clear educational language: " +
          "what it claims (roughly: nontrivial zeros of the Riemann zeta function " +
          "lie on the critical line Re(s) = 1/2), and enough context to grasp why " +
          "it matters (e.g. link to prime distribution) without requiring a full " +
          "graduate course. It does not invent named papers, proofs, or URLs as " +
          "sources, and does not falsely claim the hypothesis has been proven.",
        { on: riemannTurn.reply },
      )
      .label("riemann-hypothesis")
      .atLeast(0.8);
  },
});
