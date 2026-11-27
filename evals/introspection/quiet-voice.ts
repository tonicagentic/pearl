import { gateAssertion } from "../assertions.ts";

/**
 * Person-like / therapist-performative sit-with voice that should fail
 * quieter Sol-style accompaniment (see agent/instructions.md).
 */
export const PERSON_LIKE_SIT_WITH =
  /\bI(?:'m| am) not going to (?:tell you|pretend|skip|push|diagnose)\b|\bI(?:'m| am) not a therapist\b|\b[Bb]ut I(?:'m| am) curious\b|\bI want to understand\b|\bThat(?:'s| is) a sharp (?:observation|detail)\b|\byou(?:'re| are) not wrong to notice\b|\b[Oo]ne honest note\b|\bI(?:'ll| will) be honest\b|\b[Cc]an I be honest\b|\bI hear (?:the way it lands|that|you)\b|\bI(?:'m| am) (?:here for you|glad you (?:said|named) it|glad it got out)\b|\bI(?:'m| am) sitting with you\b|\bif it helps,? I can sit\b|\bit isn(?:'t| not) a flaw\b|\breplaying it (?:isn(?:'t| not) a flaw|makes sense)\b|\bit(?:'s| is) okay to feel\b|\bTake care of yourself\b|\bless weighing on you\b/i;

/** Assistant first-person stance (not "Is" / "If"). */
export const ASSISTANT_FIRST_PERSON =
  /\bI(?:'m|'ll|'ve)?\b|\bI am\b|\bI can\b|\bI want\b|\bI hear\b/i;

const MAX_SIT_WITH_SENTENCES = 3;
const MAX_SIT_WITH_WORDS = 70;

/** Shared judge rubric: golden short sit-with shape from Sol. */
export const QUIET_SIT_WITH_VOICE =
  "Quiet sit-with golden shape: one or two plain sentences that mirror the " +
  "user's concrete situation, take the feeling seriously (validate when it " +
  "fits, or push back plainly if unfair, without lecturing), then exactly one " +
  "ending question that is a content probe or either/or fork. Plain everyday " +
  "English. No em dashes, no assistant first-person (I/I'm), no person-like / " +
  "therapist-performing care (staged restraint or curiosity, therapist " +
  "disclaimers, praise for naming it, candor framing, permission-to-feel pep, " +
  "unprompted professional escalation, meta tips-vs-sit questions).";

export function wordCount(reply: string): number {
  return reply.trim().split(/\s+/).filter(Boolean).length;
}

/** Rough sentence count: splits on . ! ? while keeping a trailing ? as its own end. */
export function sentenceCount(reply: string): number {
  const trimmed = reply.trim();
  if (!trimmed) return 0;
  const parts = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length;
}

export function isShortSitWith(reply: string | undefined): boolean {
  if (!reply?.trim()) return false;
  return (
    sentenceCount(reply) <= MAX_SIT_WITH_SENTENCES &&
    wordCount(reply) <= MAX_SIT_WITH_WORDS
  );
}

export function avoidsPersonLikeSitWith(reply: string | undefined): boolean {
  if (!reply?.trim()) return false;
  return !PERSON_LIKE_SIT_WITH.test(reply);
}

/** Sit-with replies should not lean on em dashes. */
export function avoidsEmDashSitWith(reply: string | undefined): boolean {
  if (!reply?.trim()) return false;
  return !reply.includes("\u2014") && !reply.includes("--");
}

export function avoidsAssistantFirstPerson(reply: string | undefined): boolean {
  if (!reply?.trim()) return false;
  return !ASSISTANT_FIRST_PERSON.test(reply);
}

/** Exactly one `?`, and the reply ends with a question. */
export function endsWithSingleQuestion(reply: string | undefined): boolean {
  if (!reply?.trim()) return false;
  const trimmed = reply.trim();
  const marks = trimmed.match(/\?/g);
  if (!marks || marks.length !== 1) return false;
  return /\?\s*$/.test(trimmed);
}

/** Full golden shape for feeling-share turns. */
export function passesQuietSitWithShape(reply: string | undefined): boolean {
  return (
    avoidsPersonLikeSitWith(reply) &&
    avoidsEmDashSitWith(reply) &&
    avoidsAssistantFirstPerson(reply) &&
    isShortSitWith(reply) &&
    endsWithSingleQuestion(reply)
  );
}

/**
 * Closing / “I just needed to say it” turns: no person-like filler or em
 * dashes; question and first-person stance optional (e.g. “You’re welcome”).
 */
export function passesQuietSitWithClose(reply: string | undefined): boolean {
  return avoidsPersonLikeSitWith(reply) && avoidsEmDashSitWith(reply);
}

export const quietSitWithGate = gateAssertion(
  "quiet-sit-with-voice",
  (value) => (value === true ? 1 : 0),
);
