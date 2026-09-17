import {
  beginExecution,
  completeExecution,
  executionKey,
  failExecution,
  getExecution,
} from "./execution-ledger.ts";
import { checkEgress } from "../privacy/redact.ts";

// The destructive-notification behavior behind agent/tools/send_notification.ts.
// Isolated from the tool wrapper so the unit and fault-injection tiers can run
// it with plain `node --test` (relative imports only, no path aliases).
//
// Protections, all enforced in code:
//   1. Confirmation gate — the tool wrapper declares `approval: always()`; the
//      approval-policy tests pin that execute() is unreachable without a
//      resolved approval.
//   2. Idempotency — the Postgres execution ledger: a replayed key re-reports
//      the original receipt without re-firing; a `pending` row from a crash
//      mid-delivery is surfaced as `incomplete`, never silently retried.
//   3. Egress gate — private context classes are refused before any request
//      leaves the process.

export type SendNotificationInput = {
  readonly recipient: string;
  readonly message: string;
  readonly idempotencyKey?: string | null;
};

export type SendDeps = {
  /** The side effect itself. Injectable so fault-injection tests swap the network. */
  deliver: (endpoint: string, body: string) => Promise<string>;
  /** Where deliveries go. Injectable for tests; production reads the env. */
  resolveEndpoint?: () => string | null;
};

export function keyFor(input: SendNotificationInput): string {
  return executionKey(
    "send_notification",
    input.idempotencyKey ?? `${input.recipient}\u0000${input.message}`,
  );
}

export async function executeSend(
  input: SendNotificationInput,
  deps: SendDeps,
): Promise<Record<string, unknown>> {
  const egress = checkEgress(`${input.recipient}\n${input.message}`);
  if (!egress.ok) {
    return { status: "refused", reason: egress.reason };
  }

  const key = keyFor(input);
  const prior = await beginExecution("send_notification", key);

  if (prior.prior?.status === "succeeded") {
    return { status: "already-delivered", receipt: prior.prior.detail };
  }

  if (prior.prior?.status === "pending") {
    return {
      status: "incomplete",
      detail:
        "A previous delivery attempt is recorded as pending — the side effect may or may not have been sent. Check the delivery endpoint before retrying; this call did not send anything.",
    };
  }

  const endpoint = (deps.resolveEndpoint ?? defaultEndpoint)();
  if (!endpoint) {
    await failExecution(key, "NOTIFICATION_ENDPOINT is not configured");
    return {
      status: "unconfigured",
      detail:
        "NOTIFICATION_ENDPOINT is not configured, so nothing was sent. Set it in the environment before asking to send notifications.",
    };
  }

  try {
    const receipt = await deps.deliver(endpoint, JSON.stringify(input));
    await completeExecution(key, receipt);
    return { status: "delivered", receipt };
  } catch (error) {
    await failExecution(key, error instanceof Error ? error.message : String(error));
    throw new Error(
      `Notification delivery failed and was not retried (idempotency key ${key.slice(0, 12)}…). ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Exposed for the double-execution tests: the ledger state after a fault
// (e.g. a crash between deliver() and completeExecution()) is what a status
// check must read before any retry.
export { getExecution as readExecutionState };

function defaultEndpoint(): string | null {
  return process.env.NOTIFICATION_ENDPOINT?.trim() || null;
}
