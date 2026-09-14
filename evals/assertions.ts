import type { Assertion } from "eve/evals";

// Gate assertion factory shared by eval files. Import via
// `#evals/assertions.js` (the package.json import map maps `#evals/*` to
// `./evals/*`).
export function gateAssertion(
  name: string,
  score: (value: unknown) => number,
): Assertion {
  const self: Assertion = {
    name,
    severity: "gate",
    score,
    gate: () => self,
    soft: () => self,
    atLeast: () => self,
  };
  return self;
}
