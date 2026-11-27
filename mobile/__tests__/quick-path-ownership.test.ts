/**
 * Pure ownership rules for in-flight quick-path streams across chat switches.
 * Mirrors the guards in chat-screen's quick-path send / projection.
 */

function shouldPaintQuickStream(input: {
  readonly quickStreaming: boolean;
  readonly owner: object | null;
  readonly activeStore: object;
}): boolean {
  return input.quickStreaming && input.owner === input.activeStore;
}

function shouldApplyQuickCompletion(input: {
  readonly owner: object | null;
  readonly activeStore: object;
}): boolean {
  return input.owner === input.activeStore;
}

describe("quick-path ownership", () => {
  const storeA = { id: "a" };
  const storeB = { id: "b" };

  it("paints in-flight text only while the owning store is active", () => {
    expect(
      shouldPaintQuickStream({
        quickStreaming: true,
        owner: storeA,
        activeStore: storeA,
      }),
    ).toBe(true);
    expect(
      shouldPaintQuickStream({
        quickStreaming: true,
        owner: storeA,
        activeStore: storeB,
      }),
    ).toBe(false);
  });

  it("applies completion turns only to the originating store", () => {
    expect(
      shouldApplyQuickCompletion({ owner: storeA, activeStore: storeA }),
    ).toBe(true);
    expect(
      shouldApplyQuickCompletion({ owner: storeA, activeStore: storeB }),
    ).toBe(false);
  });
});
