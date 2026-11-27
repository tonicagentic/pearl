import { gateAssertion } from "#evals/assertions.js";

/** Ground a factual turn with search or a fetched page (mini often fetches). */
export function lookedUpWeb(
  toolCalls: ReadonlyArray<{ readonly name: string }>,
): boolean {
  return toolCalls.some(
    (call) => call.name === "web_search" || call.name === "web_fetch",
  );
}

export const lookedUpWebGate = gateAssertion(
  "looked-up-web",
  (value) => (value === true ? 1 : 0),
);
