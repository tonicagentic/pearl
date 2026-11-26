export type CatalogAssertion =
  | {
      kind: "judge";
      label?: string;
      threshold?: number;
      instructions: string;
    }
  | {
      kind: "gate";
      name: string;
    }
  | {
      kind: "check";
      detail: string;
    };

export type CatalogTurn = {
  index: number;
  prompt: string;
  /** Fixture names referenced in this send() input. */
  fixtureNames: string[];
  assertions: CatalogAssertion[];
};

/** One independent scenario (usually one `t.session()`). Turns are sends inside it. */
export type CatalogCase = {
  index: number;
  label: string;
  description: string;
  turns: CatalogTurn[];
};

/** Named fixture data from `fixtures/` or local consts in the eval file. */
export type CatalogFixture = {
  name: string;
  /** Where it was defined, e.g. `fixtures/offer.ts` or `local`. */
  source: string;
  kind: "record" | "text";
  /** For record fixtures: field → value. */
  fields?: Record<string, string>;
  /** For text / joined-prompt fixtures. */
  text?: string;
};

export type CatalogEval = {
  id: string;
  suite: string;
  name: string;
  file: string;
  description: string;
  tags: string[];
  timeoutMs?: number;
  /** Flat lists for search; prefer `cases` in the UI. */
  assertions: CatalogAssertion[];
  prompts: string[];
  /** @deprecated Prefer cases; kept as flattened turns for search. */
  turns: CatalogTurn[];
  cases: CatalogCase[];
  /** Fixtures this eval imports or defines (beyond expanded send inputs). */
  fixtures: CatalogFixture[];
};

export type CatalogSuite = {
  id: string;
  title: string;
  blurb: string;
  /** Agent this suite belongs to (`pearl` root, or a subagent like `coder`). */
  agent: string;
  /** Shared suite fixtures under `evals/<suite>/fixtures/`. */
  fixtures: CatalogFixture[];
  evals: CatalogEval[];
};

/** One agent’s eval set in Spec (Pearl root or a named subagent). */
export type CatalogAgent = {
  id: string;
  label: string;
  description: string;
  suites: CatalogSuite[];
};
