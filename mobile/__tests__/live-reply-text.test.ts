import {
  __resetLiveReplyTextForTests,
  clearLiveReplyText,
  getLiveReplyParts,
  pushLiveReplyDelta,
  reconcileLiveReplyWithSnapshot,
} from "../src/live-reply-text";
import { applyLiveReplyOverlay } from "../src/apply-live-reply";

beforeEach(() => {
  __resetLiveReplyTextForTests();
});

describe("pushLiveReplyDelta", () => {
  it("treats omitted kind as text", () => {
    pushLiveReplyDelta({ partId: "p1", delta: "Hello" });
    expect(getLiveReplyParts()).toEqual([{ id: "p1", text: "Hello" }]);
  });

  it("rejects explicit non-text kinds", () => {
    pushLiveReplyDelta({
      partId: "r1",
      kind: "reasoning",
      delta: "secret",
    });
    expect(getLiveReplyParts()).toEqual([]);
  });

  it("accumulates deltas on the same part", () => {
    pushLiveReplyDelta({ partId: "p1", kind: "text", delta: "Hel" });
    pushLiveReplyDelta({ partId: "p1", delta: "lo" });
    expect(getLiveReplyParts()).toEqual([{ id: "p1", text: "Hello" }]);
  });
});

describe("reconcileLiveReplyWithSnapshot", () => {
  it("keeps deltas ahead of the snapshot", () => {
    pushLiveReplyDelta({ partId: "p1", delta: "Hello world" });
    reconcileLiveReplyWithSnapshot([
      {
        role: "assistant",
        parts: [{ id: "p1", type: "text", text: "Hello" }],
      },
    ]);
    expect(getLiveReplyParts()).toEqual([{ id: "p1", text: "Hello world" }]);
  });

  it("clears when the snapshot catches up", () => {
    pushLiveReplyDelta({ partId: "p1", delta: "Hello" });
    reconcileLiveReplyWithSnapshot([
      {
        role: "assistant",
        parts: [{ id: "p1", type: "text", text: "Hello" }],
      },
    ]);
    expect(getLiveReplyParts()).toEqual([]);
  });
});

describe("applyLiveReplyOverlay", () => {
  it("extends an assistant bubble with ahead-of-line text", () => {
    pushLiveReplyDelta({ partId: "p1", delta: "Hello world" });
    const next = applyLiveReplyOverlay([
      {
        role: "assistant",
        content: [{ type: "text", id: "p1", text: "Hello" }],
      },
    ]);
    expect(next[0]?.content).toEqual([
      { type: "text", id: "p1", text: "Hello world" },
    ]);
  });

  afterEach(() => {
    clearLiveReplyText();
  });
});
