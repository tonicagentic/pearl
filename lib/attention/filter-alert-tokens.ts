/** A row is "live" only while active and recently heartbeated. */
export const ATTENTION_FRESH_MS = 25_000;

export type AttentionSurface = "mobile" | "web";
export type AttentionState = "active" | "background";

export type AttentionSnapshot = {
  readonly surface: AttentionSurface;
  readonly clientKey: string;
  readonly state: AttentionState;
  readonly chatId: string | null;
  readonly sessionId: string | null;
  readonly updatedAt: Date;
};

export type AlertToken = {
  readonly token: string;
};

function isFresh(
  row: AttentionSnapshot,
  now: number,
  freshMs: number,
): boolean {
  if (row.state !== "active") {
    return false;
  }
  return now - row.updatedAt.getTime() <= freshMs;
}

function watchesConversation(
  row: AttentionSnapshot,
  chatId: string,
  sessionId: string,
): boolean {
  if (row.chatId && row.chatId === chatId) {
    return true;
  }
  if (row.sessionId && row.sessionId === sessionId) {
    return true;
  }
  return false;
}

/**
 * Decide which Expo tokens should receive a visible alert banner.
 *
 * - A fresh web viewer on this chat/session suppresses every device.
 * - A fresh foreground phone drops only that device's token (clientKey =
 *   Expo push token). Other locked phones still get the alert.
 */
export function filterAlertPushTokens(input: {
  readonly tokens: readonly AlertToken[];
  readonly attention: readonly AttentionSnapshot[];
  readonly chatId: string;
  readonly sessionId: string;
  readonly now?: number;
  readonly freshMs?: number;
}): {
  readonly tokens: readonly AlertToken[];
  readonly suppressAll: boolean;
} {
  const now = input.now ?? Date.now();
  const freshMs = input.freshMs ?? ATTENTION_FRESH_MS;
  const live = input.attention.filter((row) => isFresh(row, now, freshMs));

  const webWatching = live.some(
    (row) =>
      row.surface === "web" &&
      watchesConversation(row, input.chatId, input.sessionId),
  );
  if (webWatching) {
    return { tokens: [], suppressAll: true };
  }

  const foregroundMobileKeys = new Set(
    live
      .filter((row) => row.surface === "mobile")
      .map((row) => row.clientKey),
  );

  if (foregroundMobileKeys.size === 0) {
    return { tokens: input.tokens, suppressAll: false };
  }

  const tokens = input.tokens.filter(
    (row) => !foregroundMobileKeys.has(row.token),
  );
  return {
    tokens,
    suppressAll: tokens.length === 0 && input.tokens.length > 0,
  };
}
