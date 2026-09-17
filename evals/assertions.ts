import type { Assertion } from "eve/evals";

// Gate assertion factory shared by eval files. Import via
// `#evals/assertions.js` (the package.json import map maps `#evals/*` to
// `./evals/*`).
export function gateAssertion(
  name: string,
  score: (value: unknown) => number,
): Assertion {
  const make = (severity: "gate" | "soft"): Assertion => ({
    name,
    severity,
    score,
    gate: () => make("gate"),
    soft: () => make("soft"),
    atLeast: () => make("gate"),
  });

  return make("gate");
}

