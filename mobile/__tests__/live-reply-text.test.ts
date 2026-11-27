import {
  __resetLiveReplyTextForTests,
  clearLiveReplyText,
  getLiveReplyParts,
  getLiveReplyTurnId,
  pushLiveReplyDelta,
  reconcileLiveReplyWithSnapshot,
  seedLiveReplyParts,
} from "../src/live-reply-text";
import { applyLiveReplyOverlay } from "../src/apply-live-reply";

const sessionA = { id: "a" };
const sessionB = { id: "b" };

beforeEach(() => {
  __resetLiveReplyTextForTests();
});

describe("pushLiveReplyDelta", () => {
  it("treats omitted kind as text", () => {
    pushLiveReplyDelta(sessionA, { partId: "p1", delta: "Hello" });
    expect(getLiveReplyParts(sessionA)).toEqual([
      { id: "p1", text: "Hello", turnId: null },
    ]);
  });

  it("rejects explicit non-text kinds", () => {
    pushLiveReplyDelta(sessionA, {
      partId: "r1",
      kind: "reasoning",
      delta: "secret",
    });
    expect(getLiveReplyParts(sessionA)).toEqual([]);
  });

  it("accumulates deltas on the same part", () => {
    pushLiveReplyDelta(sessionA, { partId: "p1", kind: "text", delta: "Hel" });
    pushLiveReplyDelta(sessionA, { partId: "p1", delta: "lo" });
    expect(getLiveReplyParts(sessionA)).toEqual([
      { id: "p1", text: "Hello", turnId: null },
    ]);
  });

  it("keeps concurrent sessions isolated with the same partId", () => {
    pushLiveReplyDelta(sessionA, {
      turnId: "tA",
      partId: "p1",
      delta: "Alpha",
    });
    pushLiveReplyDelta(sessionB, {
      turnId: "tB",
      partId: "p1",
      delta: "Beta",
    });
    pushLiveReplyDelta(sessionA, { turnId: "tA", partId: "p1", delta: "!" });
    expect(getLiveReplyParts(sessionA)).toEqual([
      { id: "p1", text: "Alpha!", turnId: "tA" },
    ]);
    expect(getLiveReplyParts(sessionB)).toEqual([
      { id: "p1", text: "Beta", turnId: "tB" },
    ]);
  });

  it("drops prior parts when the turnId changes on the same session", () => {
    pushLiveReplyDelta(sessionA, {
      turnId: "t1",
      partId: "p1",
      delta: "old",
    });
    pushLiveReplyDelta(sessionA, {
      turnId: "t2",
      partId: "p2",
      delta: "new",
    });
    expect(getLiveReplyParts(sessionA)).toEqual([
      { id: "p2", text: "new", turnId: "t2" },
    ]);
    expect(getLiveReplyTurnId(sessionA)).toBe("t2");
  });
});

describe("seedLiveReplyParts", () => {
  it("seeds a held catch-up reply in one shot", () => {
    seedLiveReplyParts(sessionA, {
      turnId: "t1",
      parts: [{ id: "p1", text: "Hello world" }],
    });
    expect(getLiveReplyParts(sessionA)).toEqual([
      { id: "p1", text: "Hello world", turnId: "t1" },
    ]);
  });

  it("replaces any prior buffer so catch-up does not append twice", () => {
    pushLiveReplyDelta(sessionA, { partId: "p1", delta: "stale" });
    seedLiveReplyParts(sessionA, {
      parts: [{ id: "p1", text: "fresh reply" }],
    });
    expect(getLiveReplyParts(sessionA)).toEqual([
      { id: "p1", text: "fresh reply", turnId: null },
    ]);
  });

  it("does not seed empty parts", () => {
    seedLiveReplyParts(sessionA, { parts: [] });
    expect(getLiveReplyParts(sessionA)).toEqual([]);
  });

  it("leaves another session untouched when seeding", () => {
    pushLiveReplyDelta(sessionB, { partId: "p1", delta: "keep" });
    seedLiveReplyParts(sessionA, {
      parts: [{ id: "p1", text: "seeded" }],
    });
    expect(getLiveReplyParts(sessionB)).toEqual([
      { id: "p1", text: "keep", turnId: null },
    ]);
  });
});

describe("reconcileLiveReplyWithSnapshot", () => {
  it("keeps deltas ahead of the snapshot", () => {
    pushLiveReplyDelta(sessionA, { partId: "p1", delta: "Hello world" });
    reconcileLiveReplyWithSnapshot(sessionA, [
      {
        role: "assistant",
        parts: [{ id: "p1", type: "text", text: "Hello" }],
      },
    ]);
    expect(getLiveReplyParts(sessionA)).toEqual([
      { id: "p1", text: "Hello world", turnId: null },
    ]);
  });

  it("clears when the snapshot catches up", () => {
    pushLiveReplyDelta(sessionA, { partId: "p1", delta: "Hello" });
    reconcileLiveReplyWithSnapshot(sessionA, [
      {
        role: "assistant",
        parts: [{ id: "p1", type: "text", text: "Hello" }],
      },
    ]);
    expect(getLiveReplyParts(sessionA)).toEqual([]);
  });

  it("does not clear another session when this one catches up", () => {
    pushLiveReplyDelta(sessionA, { partId: "p1", delta: "Hello" });
    pushLiveReplyDelta(sessionB, { partId: "p1", delta: "Other" });
    reconcileLiveReplyWithSnapshot(sessionA, [
      {
        role: "assistant",
        parts: [{ id: "p1", type: "text", text: "Hello" }],
      },
    ]);
    expect(getLiveReplyParts(sessionA)).toEqual([]);
    expect(getLiveReplyParts(sessionB)).toEqual([
      { id: "p1", text: "Other", turnId: null },
    ]);
  });
});

describe("applyLiveReplyOverlay", () => {
  it("extends an assistant bubble with ahead-of-line text", () => {
    pushLiveReplyDelta(sessionA, { partId: "p1", delta: "Hello world" });
    const next = applyLiveReplyOverlay(
      [
        {
          role: "assistant",
          content: [{ type: "text", id: "p1", text: "Hello" }],
        },
      ],
      getLiveReplyParts(sessionA),
    );
    expect(next[0]?.content).toEqual([
      { type: "text", id: "p1", text: "Hello world" },
    ]);
  });

  it("does not paint another session's parts into this thread", () => {
    pushLiveReplyDelta(sessionA, { partId: "p1", delta: "Alpha" });
    pushLiveReplyDelta(sessionB, { partId: "p2", delta: "Beta" });
    const next = applyLiveReplyOverlay(
      [
        {
          role: "assistant",
          content: [{ type: "text", id: "p1", text: "A" }],
        },
      ],
      getLiveReplyParts(sessionA),
    );
    const texts = (next[0]?.content as { text?: string }[]).map(
      (part) => part.text,
    );
    expect(texts.join("")).toContain("Alpha");
    expect(texts.join("")).not.toContain("Beta");
  });

  it("does not splice a mismatched turnId into an existing assistant row", () => {
    const next = applyLiveReplyOverlay(
      [
        {
          role: "assistant",
          content: [{ type: "text", id: "p1", text: "Hello" }],
          metadata: { custom: { turnId: "turn_a" } },
        },
      ],
      [{ id: "p2", text: "Intruder", turnId: "turn_b" }],
    );
    expect(next[0]?.content).toEqual([
      { type: "text", id: "p1", text: "Hello" },
    ]);
  });

  afterEach(() => {
    clearLiveReplyText(sessionA);
    clearLiveReplyText(sessionB);
  });
});
