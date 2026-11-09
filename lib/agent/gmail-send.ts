import {
  beginExecution,
  completeExecution,
  executionKey,
  failExecution,
  reopenExecution,
} from "./execution-ledger.ts";

// The destructive-send behavior behind agent/tools/send_gmail_message.ts.
// Isolated from the tool wrapper so the unit tier can run it with plain
// `node --test` (relative imports only, no path aliases).
//
// Protections, enforced in code:
//   1. Approval — the tool wrapper declares `approval: always()`.
//   2. Idempotency — the Postgres execution ledger: a replayed send reports
//      the original message id; a `pending` row from a crash mid-send is
//      surfaced as `incomplete`, never silently retried (the mail may have
//      left already).
//   3. Plan mode — the wrapper refuses before reaching this module.
// Unlike send_notification there is no private-data egress gate: the body is
// the user's own email, shown in full on the approval card before sending.

export type SendGmailInput = {
  readonly to: string;
  readonly cc?: string | null;
  readonly bcc?: string | null;
  readonly subject: string;
  readonly body: string;
  /** Existing thread to reply into (Gmail thread id). */
  readonly threadId?: string | null;
  /** Message-ID header of the message being replied to. */
  readonly inReplyTo?: string | null;
  readonly idempotencyKey?: string | null;
};

export type GmailSendDeps = {
  /** The side effect. Injectable so fault-injection tests swap the network. */
  readonly send: (rawMessage: string, threadId: string | null) => Promise<string>;
};

const EMAIL = /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/;
/** Normalize and validate a comma-separated address list. */
export function parseAddresses(value: string | null | undefined): string[] | null {
  if (!value?.trim()) return [];
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  for (const part of parts) {
    // Reject header injection before anything reaches the raw message.
    if (/[\r\n]/.test(part)) return null;
    const address = part.match(/<([^>]+)>$/)?.[1] ?? part;
    if (!EMAIL.test(address)) return null;
  }
  return parts;
}

function encodeHeader(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function stripHeaderBreaks(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/** Build an RFC 2822 message, base64url-encoded for Gmail's `raw` field. */
export function buildRawMessage(input: {
  readonly to: readonly string[];
  readonly cc: readonly string[];
  readonly bcc: readonly string[];
  readonly subject: string;
  readonly body: string;
  readonly inReplyTo?: string | null;
}): string {
  const headers = [
    `To: ${input.to.join(", ")}`,
    ...(input.cc.length ? [`Cc: ${input.cc.join(", ")}`] : []),
    ...(input.bcc.length ? [`Bcc: ${input.bcc.join(", ")}`] : []),
    `Subject: ${encodeHeader(stripHeaderBreaks(input.subject))}`,
    ...(input.inReplyTo
      ? [
          `In-Reply-To: ${stripHeaderBreaks(input.inReplyTo)}`,
          `References: ${stripHeaderBreaks(input.inReplyTo)}`,
        ]
      : []),
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ];
  const body = Buffer.from(input.body, "utf8")
    .toString("base64")
    .replace(/(.{76})/g, "$1\r\n");
  return Buffer.from(`${headers.join("\r\n")}\r\n\r\n${body}`, "utf8").toString(
    "base64url",
  );
}

/** Thrown by a `send` dep when the message may already have been sent
 * (timeout, dropped connection, 5xx). The ledger row stays `pending`. */
export class AmbiguousSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmbiguousSendError";
  }
}

export function keyFor(userId: string, input: SendGmailInput): string {
  return executionKey(
    "send_gmail_message",
    `${userId}\u0000${
      input.idempotencyKey ??
      [input.to, input.cc ?? "", input.bcc ?? "", input.subject, input.body].join(
        "\u0000",
      )
    }`,
  );
}

export async function executeGmailSend(
  userId: string,
  input: SendGmailInput,
  deps: GmailSendDeps,
): Promise<Record<string, unknown>> {
  const to = parseAddresses(input.to);
  const cc = parseAddresses(input.cc);
  const bcc = parseAddresses(input.bcc);
  if (!to || to.length === 0 || !cc || !bcc) {
    return {
      status: "refused",
      reason: "Recipient addresses are missing or not valid email addresses.",
    };
  }
  if (!input.subject.trim() || !input.body.trim()) {
    return { status: "refused", reason: "Subject and body are required." };
  }

  const key = keyFor(userId, input);
  const { prior } = await beginExecution("send_gmail_message", key);

  if (prior?.status === "failed") {
    // The earlier attempt failed before anything was sent; reopen the row so
    // this attempt's success is recorded and a later replay cannot re-send.
    await reopenExecution(key);
  }

  if (prior?.status === "succeeded") {
    return { status: "already-sent", messageId: prior.detail };
  }

  if (prior?.status === "pending") {
    return {
      status: "incomplete",
      detail:
        "A previous send attempt is recorded as pending — the email may or may not have gone out. Check the Sent folder before retrying; this call did not send anything.",
    };
  }

  const raw = buildRawMessage({
    to,
    cc,
    bcc,
    subject: input.subject,
    body: input.body,
    inReplyTo: input.inReplyTo,
  });

  try {
    const messageId = await deps.send(raw, input.threadId ?? null);
    await completeExecution(key, messageId);
    return { status: "sent", messageId, to, subject: input.subject };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof AmbiguousSendError) {
      // The request may have reached Gmail. Leave the row `pending` so the
      // next attempt reports `incomplete` instead of risking a duplicate.
      throw new Error(
        `Gmail send outcome is unknown and was not retried (idempotency key ${key.slice(0, 12)}…). Check the Sent folder before retrying. ${message}`,
      );
    }
    await failExecution(key, message);
    throw new Error(
      `Gmail send failed and was not retried (idempotency key ${key.slice(0, 12)}…). ${message}`,
    );
  }
}
