import { reconnectSession } from "../src/session-reconnect";

function fakeStore(status: string, hasSession: boolean) {
  let current = status;
  return {
    snapshot: {
      get status() {
        return current;
      },
      session: hasSession ? { sessionId: "s1" } : null,
    },
    cancel: jest.fn(async () => {
      current = "idle";
    }),
    resume: jest.fn(async () => {
      current = "idle";
    }),
  };
}

describe("reconnectSession", () => {
  it("returns ok when there is no session", async () => {
    const store = fakeStore("idle", false);
    await expect(
      reconnectSession(store as never),
    ).resolves.toEqual({ ok: true });
    expect(store.resume).not.toHaveBeenCalled();
  });

  it("returns offline without calling resume", async () => {
    const store = fakeStore("busy", true);
    await expect(
      reconnectSession(store as never, { offline: true }),
    ).resolves.toEqual({ ok: false, error: "You're offline." });
    expect(store.resume).not.toHaveBeenCalled();
  });

  it("resumes a busy stream without cancelling the live turn", async () => {
    const store = fakeStore("busy", true);
    await expect(reconnectSession(store as never, { backoffMs: [] })).resolves.toEqual({
      ok: true,
    });
    expect(store.cancel).not.toHaveBeenCalled();
    expect(store.resume).toHaveBeenCalled();
  });

  it("leaves a turn alone when resume reports pending submissions", async () => {
    const store = fakeStore("busy", true);
    store.resume.mockRejectedValueOnce(new Error("eve session has pending submissions."));
    await expect(reconnectSession(store as never, { backoffMs: [] })).resolves.toEqual({
      ok: true,
    });
    expect(store.cancel).not.toHaveBeenCalled();
  });
});
