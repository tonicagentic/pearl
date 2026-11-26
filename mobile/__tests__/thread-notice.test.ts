import { classifyThreadNotice } from "../src/chat/thread-notice";

describe("classifyThreadNotice", () => {
  const base = {
    offline: false,
    connectionError: null,
    persistenceError: null,
    sendError: null,
    canResend: false,
    sendPreparing: false,
    pendingMessage: null,
    hasLocalSend: false,
    hasLoadedHistory: true,
    showReplyInterrupted: false,
    unifiedEveError: null,
  };

  it("routes save failures to the error chrome", () => {
    const notice = classifyThreadNotice({
      ...base,
      persistenceError: "Save failed",
      onRetrySave: () => {},
    });
    expect(notice).toMatchObject({
      kind: "error",
      title: "Could not save this chat.",
      detail: "It’s still on this phone.",
      actionLabel: "Retry",
    });
  });

  it("routes connection drops to ConnectionState", () => {
    const notice = classifyThreadNotice({
      ...base,
      connectionError: "Lost the connection to Pearl.",
      onReconnect: () => {},
    });
    expect(notice).toMatchObject({
      kind: "connection",
      phase: "dropped",
      message: "Connection lost. The run kept going on the server.",
    });
  });

  it("keeps offline save failures visible", () => {
    const notice = classifyThreadNotice({
      ...base,
      offline: true,
      persistenceError: "Save failed",
    });
    expect(notice?.kind).toBe("error");
  });

  it("stays quiet when nothing failed", () => {
    expect(classifyThreadNotice(base)).toBeNull();
  });

  it("maps empty-turn copy to a short error", () => {
    const notice = classifyThreadNotice({
      ...base,
      sendError: "Pearl didn't return a reply for this turn.",
      hasLocalSend: true,
      onResend: () => {},
    });
    expect(notice).toMatchObject({
      kind: "error",
      title: "Pearl didn’t return a reply.",
      detail: "Send it again.",
      actionLabel: "Retry",
    });
  });
});
