import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  endsWithSingleQuestion,
  isShortSitWith,
  passesQuietSitWithClose,
  passesQuietSitWithShape,
  avoidsAssistantFirstPerson,
  avoidsEmDashSitWith,
  avoidsPersonLikeSitWith,
} from "../evals/introspection/quiet-voice.ts";

const GOLDEN = [
  "Feeling down and wishing you could be a little more carefree sounds tiring. Is something weighing on you, or is it more of a general mood today?",
  "An interview coming up this afternoon can make the nerves feel pretty immediate. What part are you most worried about?",
  "Finding out afterward can hurt, especially when you’re left wondering why you weren’t included. What keeps replaying most, the weekend you missed or what it might mean about your place in the group?",
  "That sounds exhausting, coming off a long call and feeling empty rather than angry. What part of the call stayed with you?",
  "You’re welcome. No homework.",
] as const;

const BAD = [
  "I'm not going to tell you to just let it go. But I'm curious: when you replay it, is it mostly the feeling of not being invited?",
  "That's a sharp observation, and you're not wrong to notice it. One honest note: high school exclusion is usually felt as 'I don't belong.' Still, I hear the way it lands.",
  "Feeling down and wishing things felt a little lighter—less weighing on you. Is something in particular making it hard to feel carefree right now?",
  "That sounds like a real pull, and I'm glad you named it. I'm not a therapist, but I hear that wanting the lighter feeling back.",
] as const;

describe("quiet sit-with voice helpers", () => {
  it("accepts golden Sol sit-with replies as full shape (except close)", () => {
    for (const reply of GOLDEN.slice(0, 4)) {
      assert.equal(passesQuietSitWithShape(reply), true, reply);
    }
  });

  it("accepts the thank-you close via close-shape only", () => {
    const close = GOLDEN[4];
    assert.equal(passesQuietSitWithClose(close), true);
    assert.equal(endsWithSingleQuestion(close), false);
    assert.equal(passesQuietSitWithShape(close), false);
  });

  it("rejects person-like, em-dash, and first-person samples", () => {
    assert.equal(avoidsPersonLikeSitWith(BAD[0]), false);
    assert.equal(avoidsPersonLikeSitWith(BAD[1]), false);
    assert.equal(avoidsEmDashSitWith(BAD[2]), false);
    assert.equal(avoidsAssistantFirstPerson(BAD[3]), false);
    for (const reply of BAD) {
      assert.equal(passesQuietSitWithShape(reply), false, reply);
    }
  });

  it("requires a short stack and a single ending question", () => {
    const long =
      "Finding out afterward can hurt. ".repeat(20) +
      "What keeps replaying most?";
    assert.equal(isShortSitWith(long), false);
    assert.equal(
      endsWithSingleQuestion("What part? Or is it something else?"),
      false,
    );
    assert.equal(
      endsWithSingleQuestion(
        "An interview this afternoon can feel tense. What part worries you most?",
      ),
      true,
    );
  });
});
