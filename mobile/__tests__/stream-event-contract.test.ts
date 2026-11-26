import {
  assertKnownStreamEvent,
  classifyStreamEvent,
  EVE_STREAM_EVENT_TYPES,
  isCatchUpChromeProgress,
  isKnownStreamEventType,
  shouldClearCatchUpOnEvent,
} from "../src/chat/stream-event-contract";
import {
  assertFixturesCoverCatalog,
  minimalByType,
  STREAM_SCENARIOS,
  typesCoveredByScenarios,
} from "../src/chat/stream-event-fixtures";

describe("stream-event-contract", () => {
  it("classifies every catalog type", () => {
    expect(EVE_STREAM_EVENT_TYPES).toHaveLength(31);
    for (const type of EVE_STREAM_EVENT_TYPES) {
      const tier = classifyStreamEvent(type);
      expect(tier).not.toBe("unknown");
      expect(["live", "chrome", "project", "ignore-overlay"]).toContain(tier);
    }
  });

  it("treats non-text content.delta as ignore-overlay", () => {
    expect(classifyStreamEvent("content.delta", "reasoning")).toBe(
      "ignore-overlay",
    );
    expect(classifyStreamEvent("content.delta", "text")).toBe("live");
    expect(classifyStreamEvent("content.delta")).toBe("live");
  });

  it("fails closed on unknown types", () => {
    expect(classifyStreamEvent("message.received")).toBe("unknown");
    expect(isKnownStreamEventType("not.a.real.event")).toBe(false);
    expect(() => assertKnownStreamEvent("future.event")).toThrow(
      /Unknown eve stream event type/,
    );
  });

  it("marks call.input and call.progress as catch-up chrome progress", () => {
    expect(isCatchUpChromeProgress("call.input")).toBe(true);
    expect(isCatchUpChromeProgress("call.progress")).toBe(true);
    expect(isCatchUpChromeProgress("content.delta")).toBe(false);
  });

  it("clears catch-up on session.ended and failed/cancelled turn.settled", () => {
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

  it("has a fixture for every catalog type", () => {
    assertFixturesCoverCatalog();
    for (const type of EVE_STREAM_EVENT_TYPES) {
      expect(minimalByType[type].type).toBe(type);
    }
  });

  it("covers every catalog type across fixtures and scenarios", () => {
    const covered = typesCoveredByScenarios();
    for (const type of EVE_STREAM_EVENT_TYPES) {
      expect(covered.has(type)).toBe(true);
    }
    expect(STREAM_SCENARIOS.length).toBeGreaterThanOrEqual(8);
  });
});
