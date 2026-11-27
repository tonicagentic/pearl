import { gateAssertion } from "#evals/assertions.js";

/**
 * Person-like / therapist-performative sit-with voice that should fail
 * quieter Sol-style accompaniment (see agent/instructions.md).
 */
export const PERSON_LIKE_SIT_WITH =
  /\bI(?:'m| am) not going to (?:tell you|pretend|skip|push|diagnose)\b|\bI(?:'m| am) not a therapist\b|\b[Bb]ut I(?:'m| am) curious\b|\bI want to understand\b|\bThat(?:'s| is) a sharp (?:observation|detail)\b|\byou(?:'re| are) not wrong to notice\b|\b[Oo]ne honest note\b|\bI(?:'ll| will) be honest\b|\b[Cc]an I be honest\b|\bI hear (?:the way it lands|that|you)\b|\bI(?:'m| am) (?:here for you|glad you (?:said|named) it|glad it got out)\b|\bI(?:'m| am) sitting with you\b|\bif it helps,? I can sit\b|\bit isn(?:'t| not) a flaw\b|\breplaying it (?:isn(?:'t| not) a flaw|makes sense)\b|\bit(?:'s| is) okay to feel\b|\bTake care of yourself\b|\bless weighing on you\b/i;

/** Shared judge rubric: quieter sit-with, plain English, ends with a question. */
export const QUIET_SIT_WITH_VOICE =
  "Quiet sit-with voice in plain everyday English. Takes the feeling " +
  "seriously: validates when it fits, or pushes back plainly if the feeling " +
  "looks unfair, without lecturing or rubber-stamping. Fails person-like / " +
  "therapist-performing care (staged restraint or curiosity, therapist " +
  "disclaimers, praise for naming it, candor framing, permission-to-feel pep, " +
  "unprompted professional escalation). Avoids em dashes and awkward " +
  "rephrasings. Ends with one clear question and no preamble about the " +
  "assistant's stance.";

export function avoidsPersonLikeSitWith(reply: string | undefined): boolean {
  if (!reply?.trim()) return false;
  return !PERSON_LIKE_SIT_WITH.test(reply);
}

/** Sit-with replies should not lean on em dashes. */
export function avoidsEmDashSitWith(reply: string | undefined): boolean {
  if (!reply?.trim()) return false;
  return !reply.includes("\u2014") && !reply.includes("--");
}

/** Sit-with replies should end with a question. */
export function endsWithQuestion(reply: string | undefined): boolean {
  if (!reply?.trim()) return false;
  return /\?\s*$/.test(reply.trim());
}

export function passesQuietSitWithShape(reply: string | undefined): boolean {
  return (
    avoidsPersonLikeSitWith(reply) &&
    avoidsEmDashSitWith(reply) &&
    endsWithQuestion(reply)
  );
}

export const quietSitWithGate = gateAssertion(
  "quiet-sit-with-voice",
  (value) => (value === true ? 1 : 0),
);
