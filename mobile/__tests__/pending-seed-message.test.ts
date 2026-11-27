import {
  getPendingSeedMessage,
  SET_NEW_GOAL_MESSAGE,
  setPendingSeedMessage,
  takePendingSeedMessage,
} from "../src/pending-seed-message";

describe("pending-seed-message", () => {
  afterEach(() => {
    takePendingSeedMessage();
  });

  it("stores and takes a seed once", () => {
    setPendingSeedMessage(SET_NEW_GOAL_MESSAGE);
    expect(getPendingSeedMessage()).toBe(SET_NEW_GOAL_MESSAGE);
    expect(takePendingSeedMessage()).toBe(SET_NEW_GOAL_MESSAGE);
    expect(getPendingSeedMessage()).toBeNull();
    expect(takePendingSeedMessage()).toBeNull();
  });

  it("ignores blank seeds", () => {
    setPendingSeedMessage("   ");
    expect(getPendingSeedMessage()).toBeNull();
  });
});
