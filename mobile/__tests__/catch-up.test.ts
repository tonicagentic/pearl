import {
  collapseHeldDeltas,
  flushCatchUpHold,
  routeCatchUpDelta,
  shouldClearCatchUpOnEvent,
  shouldKeepBackgroundSubscription,
  shouldKeepPendingDraft,
  shouldSuppressLiveChrome,
  type HeldDelta,
} from "../src/chat/catch-up";
import { isCatchUpChromeProgress } from "../src/chat/stream-event-contract";

describe("routeCatchUpDelta", () => {
  it("holds text deltas while resuming", () => {
    expect(routeCatchUpDelta({ status: "resuming" })).toEqual({ kind: "hold" });
    expect(routeCatchUpDelta({ status: "resuming", kind: "text" })).toEqual({
      kind: "hold",
    });
  });

  it("pushes text deltas when live", () => {
    expect(routeCatchUpDelta({ status: "busy" })).toEqual({ kind: "push" });
    expect(routeCatchUpDelta({ status: "idle", kind: "text" })).toEqual({
      kind: "push",
    });
  });

  it("ignores reasoning and other non-text kinds", () => {
    expect(
      routeCatchUpDelta({ status: "resuming", kind: "reasoning" }),
    ).toEqual({ kind: "ignore" });
    expect(routeCatchUpDelta({ status: "busy", kind: "reasoning" })).toEqual({
      kind: "ignore",
    });
  });
});

describe("flushCatchUpHold", () => {
  const held: HeldDelta[] = [
    { partId: "p1", delta: "Hello ", kind: "text" },
    { partId: "p1", delta: "world" },
  ];

  it("noops on an empty hold so a warm idle resume does not snap", () => {
    expect(flushCatchUpHold({ status: "idle", held: [] })).toEqual({
      kind: "noop",
    });
    expect(flushCatchUpHold({ status: "busy", held: [] })).toEqual({
      kind: "noop",
    });
  });

  it("seeds when the turn is still busy after catch-up", () => {
    expect(flushCatchUpHold({ status: "busy", held })).toEqual({
      kind: "seed",
      held,
    });
  });

  it("drops when the reply finished during catch-up", () => {
    expect(flushCatchUpHold({ status: "idle", held })).toEqual({
      kind: "drop",
    });
  });

  it("drops when waiting on the person after catch-up", () => {
    // Waiting sessions report idle; held text belongs to the settled snapshot.
    expect(flushCatchUpHold({ status: "idle", held })).toEqual({
      kind: "drop",
    });
  });
});

describe("collapseHeldDeltas", () => {
  it("collapses held deltas into one part string", () => {
    expect(
      collapseHeldDeltas([
        { turnId: "t1", partId: "p1", delta: "Hel", kind: "text" },
        { partId: "p1", delta: "lo" },
        { partId: "p2", delta: " there", kind: "text" },
      ]),
    ).toEqual({
      turnId: "t1",
      parts: [
        { id: "p1", text: "Hello" },
        { id: "p2", text: " there" },
      ],
    });
  });

  it("skips reasoning holds", () => {
    expect(
      collapseHeldDeltas([
        { partId: "r1", delta: "secret", kind: "reasoning" },
        { partId: "r1", delta: " tail" },
        { partId: "p1", delta: "Hi", kind: "text" },
      ]),
    ).toEqual({
      turnId: null,
      parts: [{ id: "p1", text: "Hi" }],
    });
  });
});

describe("shouldKeepBackgroundSubscription", () => {
  it("keeps the observer only while busy or a send is pending", () => {
    expect(
      shouldKeepBackgroundSubscription({
        status: "busy",
        pendingMessage: false,
      }),
    ).toBe(true);
    expect(
      shouldKeepBackgroundSubscription({
        status: "idle",
        pendingMessage: true,
      }),
    ).toBe(true);
    expect(
      shouldKeepBackgroundSubscription({
        status: "idle",
        pendingMessage: false,
      }),
    ).toBe(false);
    expect(
      shouldKeepBackgroundSubscription({
        status: "resuming",
        pendingMessage: false,
      }),
    ).toBe(false);
  });
});

describe("shouldKeepPendingDraft", () => {
  it("keeps an unsent draft when history has no delivery.consumed", () => {
    expect(
      shouldKeepPendingDraft({
        pendingMessage: "hello",
        hasHistory: true,
        hasConsumed: false,
      }),
    ).toBe("hello");
    expect(
      shouldKeepPendingDraft({
        pendingMessage: "hello",
        hasHistory: false,
        hasConsumed: false,
      }),
    ).toBe("hello");
  });

  it("clears a draft once delivery.consumed is in history", () => {
    expect(
      shouldKeepPendingDraft({
        pendingMessage: "hello",
        hasHistory: true,
        hasConsumed: true,
      }),
    ).toBeNull();
  });

  it("returns null when there is no pending message", () => {
    expect(
      shouldKeepPendingDraft({
        pendingMessage: null,
        hasHistory: false,
        hasConsumed: false,
      }),
    ).toBeNull();
  });
});

describe("catch-up chrome", () => {
  it("suppresses live chrome while resuming", () => {
    expect(shouldSuppressLiveChrome("resuming")).toBe(true);
    expect(shouldSuppressLiveChrome("busy")).toBe(false);
    expect(shouldSuppressLiveChrome("idle")).toBe(false);
  });

  it("treats call.input and call.progress as catch-up chrome progress", () => {
    expect(isCatchUpChromeProgress("call.input")).toBe(true);
    expect(isCatchUpChromeProgress("call.progress")).toBe(true);
    // They are not live-overlay deltas — routeCatchUpDelta only applies to content.delta.
    expect(routeCatchUpDelta({ status: "resuming", kind: "text" }).kind).toBe(
      "hold",
    );
  });

  it("clears the hold on session.ended and failed/cancelled settle", () => {
    expect(shouldClearCatchUpOnEvent({ type: "session.ended" })).toBe(true);
    expect(
      shouldClearCatchUpOnEvent({ type: "turn.settled", outcome: "failed" }),
    ).toBe(true);
    expect(
      shouldClearCatchUpOnEvent({
        type: "turn.settled",
        outcome: "cancelled",
      }),
    ).toBe(true);
    expect(
      shouldClearCatchUpOnEvent({
        type: "turn.settled",
        outcome: "completed",
      }),
    ).toBe(false);
  });
});
