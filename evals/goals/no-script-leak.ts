import { gateAssertion } from "../assertions.ts";

/**
 * Deterministic gate: Goals walkthrough must not dump the instruction
 * script or tool names into user-facing text.
 */
const SCRIPT_LEAK =
  /\bask_question\b|\bdone-looks-like\b|\bcreate_goal\b|\bGoalDefinition\b|\boutcome\s*→|\bby-when\b/i;

/** True when visible reply / parked prompt looks like instruction narration. */
export function leaksGoalsWalkthroughScript(text: string): boolean {
  return SCRIPT_LEAK.test(text);
}

/** Use: `t.check(!leaksGoalsWalkthroughScript(text), noScriptLeakGate.gate())`. */
export const noScriptLeakGate = gateAssertion(
  "goals-no-script-leak",
  (value) => (value === true ? 1 : 0),
);
