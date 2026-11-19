import { showReplyInterruptedNotice } from "../src/message-projection";

describe("showReplyInterruptedNotice", () => {
  test("hides a settled failure on reopen", () => {
    expect(showReplyInterruptedNotice(true, false, false)).toBe(false);
  });

  test("shows a live interruption while the turn is still open", () => {
    expect(showReplyInterruptedNotice(true, true, false)).toBe(true);
  });

  test("hides when a local send is in flight so Resend owns the notice", () => {
    expect(showReplyInterruptedNotice(true, true, true)).toBe(false);
    expect(showReplyInterruptedNotice(true, false, true)).toBe(false);
  });

  test("hides when there is no store error", () => {
    expect(showReplyInterruptedNotice(false, true, false)).toBe(false);
  });
});
