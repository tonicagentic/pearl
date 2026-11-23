import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "“What makes a city feel nice?” / “I want to start modeling. Where do I even start?” — explore an open or ambiguous question; don’t settle it with search or a lecture.",
  tags: ["smoke"],
  timeoutMs: 180_000,
  async test(t) {
    // Case: city feel nice
    // description: User asks what makes a city feel nice. Agent thinks with them — candidate dimensions, not a sourced treatise or generic listicle.
    const city = await t.session();
    const cityTurn = await city.send("What makes a city feel nice");

    t.succeeded();
    cityTurn.notCalledTool("web_search");
    cityTurn.notCalledTool("exa_agent_run");
    cityTurn.notCalledTool("write_file");

    t.judge(
        "The reply explores what makes a city feel nice as an open qualitative " +
          "question: it offers a few concrete candidate dimensions or " +
          "distinctions (e.g. walkability, green space, human scale, noise, " +
          "light, social life — whatever fits) framed as possibilities to react " +
          "to, not a settled definitive answer. It engages the 'feel nice' " +
          "angle rather than dumping generic urban-planning jargon or a " +
          "listicle. It does not invent statistics or cite fabricated sources, " +
          "and it does not ship an artifact.",
        { on: cityTurn.reply },
      )
      .label("city-feel-nice")
      .atLeast(0.8);

    // Case: start modeling
    // description: User wants to start “modeling” with no type. Agent disambiguates (fashion / 3D / etc.) and/or offers concrete first-step hypotheses — not a settled career plan or agency list.
    const modeling = await t.session();
    const modelingTurn = await modeling.send(
      "I want to start modeling. Where do I even start?",
    );

    t.succeeded();
    modelingTurn.notCalledTool("exa_agent_run");
    modelingTurn.notCalledTool("write_file");

    t.judge(
        "The reply treats 'modeling' as ambiguous. It asks which kind (e.g. " +
          "fashion, 3D/CGI, financial, data) and/or offers a few concrete " +
          "first-step hypotheses labeled as options for a plausible reading — " +
          "not a single assumed path as settled fact. It does not invent " +
          "agencies, contacts, rates, or a company prospect list, and it does " +
          "not dump an essay or artifact.",
        { on: modelingTurn.reply },
      )
      .label("start-modeling")
      .atLeast(0.8);
  },
});
