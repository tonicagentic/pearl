export type ThreadConnectionNotice = {
  readonly kind: "connection";
  readonly phase: "dropped" | "reconnecting" | "resumed";
  readonly message?: string;
  readonly attempt?: number;
  readonly onRetry?: () => void;
  readonly onResumedClear?: () => void;
};

export type ThreadErrorNotice = {
  readonly kind: "error";
  readonly title: string;
  readonly detail: string;
  readonly retrying?: boolean;
  readonly actionLabel?: string;
  readonly onRetry?: () => void;
};

export type ThreadStatusNotice = {
  readonly kind: "status";
  readonly text: string;
};

export type ThreadFooterNotice =
  | ThreadConnectionNotice
  | ThreadErrorNotice
  | ThreadStatusNotice;

export type ClassifyThreadNoticeInput = {
  readonly offline: boolean;
  readonly connectionError: string | null;
  readonly persistenceError: string | null;
  readonly sendError: string | null;
  readonly canResend: boolean;
  readonly sendPreparing: boolean;
  readonly pendingMessage: string | null;
  readonly hasLocalSend: boolean;
  readonly hasLoadedHistory: boolean;
  readonly showReplyInterrupted: boolean;
  readonly unifiedEveError: string | null;
  readonly reconnecting?: boolean;
  readonly reconnectAttempt?: number;
  readonly saveRetrying?: boolean;
  readonly onReconnect?: () => void;
  readonly onRetrySave?: () => void;
  readonly onResend?: () => void;
  readonly onClearResumed?: () => void;
};

/**
 * Map chat failure surfaces onto connection / error / status footers.
 * Connection and save never share the same chrome.
 */
export function classifyThreadNotice(
  input: ClassifyThreadNoticeInput,
): ThreadFooterNotice | null {
  if (input.offline) {
    if (input.persistenceError) {
      return {
        kind: "error",
        title: "Could not save this chat.",
        detail: "It’s still on this phone.",
        retrying: false,
      };
    }
    if (input.canResend || input.pendingMessage) {
      return {
        kind: "error",
        title: "Couldn’t confirm delivery.",
        detail: "Open this chat again when you’re online.",
      };
    }
    return {
      kind: "connection",
      phase: "dropped",
      message: "You’re offline.",
    };
  }

  if (input.reconnecting) {
    return {
      kind: "connection",
      phase: "reconnecting",
      attempt: input.reconnectAttempt,
    };
  }

  if (input.connectionError) {
    const offlineCursor = /offline/i.test(input.connectionError);
    return {
      kind: "connection",
      phase: "dropped",
      message: offlineCursor
        ? "You’re offline."
        : input.connectionError === "Lost the connection to Pearl."
          ? "Connection lost. The run kept going on the server."
          : input.connectionError,
      onRetry: offlineCursor ? undefined : input.onReconnect,
    };
  }

  if (input.persistenceError) {
    return {
      kind: "error",
      title: "Could not save this chat.",
      detail: "It’s still on this phone.",
      retrying: Boolean(input.saveRetrying),
      actionLabel: "Retry",
      onRetry: input.onRetrySave,
    };
  }

  if (input.canResend) {
    return {
      kind: "error",
      title: "Couldn’t confirm delivery.",
      detail: "Your message is still here.",
      actionLabel: "Resend",
      onRetry: input.onResend,
    };
  }

  if (input.sendPreparing) {
    return { kind: "status", text: "Still sending your last message…" };
  }

  if (input.sendError) {
    if (/didn'?t return a reply/i.test(input.sendError)) {
      return {
        kind: "error",
        title: "Pearl didn’t return a reply.",
        detail: "Send it again.",
        actionLabel: input.hasLocalSend ? "Retry" : undefined,
        onRetry: input.hasLocalSend ? input.onResend : undefined,
      };
    }
    return {
      kind: "error",
      title: "Couldn’t reach Pearl.",
      detail: input.sendError,
      actionLabel: input.hasLocalSend ? "Resend" : undefined,
      onRetry: input.hasLocalSend ? input.onResend : undefined,
    };
  }

  if (input.unifiedEveError && !input.pendingMessage) {
    return { kind: "status", text: input.unifiedEveError };
  }

  if (input.pendingMessage && !input.hasLocalSend && !input.hasLoadedHistory) {
    return {
      kind: "error",
      title: "Couldn’t confirm delivery.",
      detail: "Open this chat again when you’re online.",
    };
  }

  if (input.showReplyInterrupted) {
    return {
      kind: "connection",
      phase: "dropped",
      message:
        "Connection lost while Pearl was replying. Your last message was saved — send a follow-up when you’re ready.",
      onRetry: input.onReconnect,
    };
  }

  return null;
}
