import type { SessionStoreSnapshot } from "eve/client";
import type { DeliveryObservation, TurnObservation } from "eve/events";

/** Structural observations keep web/mobile's separate eve instances isolated. */
export type ReplySnapshot = Pick<SessionStoreSnapshot, "messages" | "status" | "session"> & {
  readonly received?: Pick<DeliveryObservation, "status" | "turnId">;
  readonly expectedTurn?: Pick<TurnObservation, "status" | "outcome">;
  readonly hasOpenTurn: boolean;
  readonly sessionEnded: boolean;
};

/** A receipt belongs to one session, even when a SessionStore is reused. */
export type ExpectedReply = {
  readonly sessionId: string;
  readonly deliveryId: string;
};

export type ExpectedReplyState = "pending" | "answered" | "empty" | "ended";

/**
 * Diagnose only this delivery's committed turn. Transport idle/resuming and
 * historical settlements are not proof that an expected reply is missing.
 * Keep empty receipts observable: a later matching assistant row clears them.
 */
export function expectedReplyState(
  snapshot: ReplySnapshot,
  expected: ExpectedReply | undefined,
): ExpectedReplyState {
  if (!expected) return "pending";
  if (snapshot.session?.sessionId !== expected.sessionId) return "ended";
  if (snapshot.status === "resuming") return "pending";

  const received = snapshot.received;
  const turnId = received?.turnId;
  if (turnId === undefined) {
    return received?.status === "settled" || snapshot.sessionEnded
      ? "ended"
      : "pending";
  }
  if (snapshot.messages.some((message) =>
    message.role === "assistant" &&
    message.metadata?.turnId === turnId &&
    message.parts.length > 0
  )) return "answered";

  const expectedTurn = snapshot.expectedTurn;
  if (expectedTurn?.status !== "settled") {
    return snapshot.sessionEnded ? "ended" : "pending";
  }
  // Failures/cancellation have their own error surfaces; do not invite resend.
  if (expectedTurn.outcome !== "completed") return "ended";
  if (snapshot.status === "busy" || snapshot.hasOpenTurn) {
    return "pending";
  }
  return "empty";
}
