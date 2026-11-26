// Temporary debug-session logger. Removed after the freeze/send failure is confirmed.

/** Only these messages may hit the ingest server — everything else is dropped. */
const ALLOW = new Set([
  "orphan busy (no cancel)",
  "onNew entered",
  "send finished",
  "clear zombie busy before send",
  "zombie cancel failed",
]);

let postsThisMinute = 0;
let minuteStartedAt = 0;

export function agentDebugLog(
  location: string,
  message: string,
  hypothesisId: string,
  data: Record<string, unknown>,
): void {
  // #region agent log
  if (!ALLOW.has(message)) return;
  const now = Date.now();
  if (now - minuteStartedAt > 60_000) {
    minuteStartedAt = now;
    postsThisMinute = 0;
  }
  if (postsThisMinute >= 30) return;
  postsThisMinute += 1;
  try {
    fetch("http://127.0.0.1:7904/ingest/0c65059b-c338-403a-aef8-13a3f3dbe2b2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "c19eb0",
      },
      body: JSON.stringify({
        sessionId: "c19eb0",
        location,
        message,
        hypothesisId,
        data,
        timestamp: now,
      }),
    }).catch(() => {});
  } catch {
    // Jest and other non-browser callers have no fetch.
  }
  // #endregion
}

export function errorSummary(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message.slice(0, 240);
  if (typeof error === "string") return error.slice(0, 240);
  if (typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message).slice(0, 240);
  }
  return "unknown";
}

export function lastTextLength(
  messages: readonly {
    readonly role?: string;
    readonly parts?: readonly { readonly type?: string; readonly text?: string }[];
  }[],
): number {
  const last = messages[messages.length - 1];
  if (!last?.parts) return 0;
  let length = 0;
  for (const part of last.parts) {
    if (part.type === "text" && typeof part.text === "string") length += part.text.length;
  }
  return length;
}
