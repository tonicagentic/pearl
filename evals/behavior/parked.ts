import type { EveEvalContext, EveEvalTurn } from "eve/evals";

// Eval-side tolerance for the two valid confirmation styles: the agent may
// park a tool-approval request (durable HITL) or ask for confirmation in
// plain text. These helpers settle either style deterministically.

type TurnLike = EveEvalTurn & {
  inputRequests: readonly {
    requestId: string;
    kind?: string;
  }[];
};

/** True when the turn parked on a tool-approval request. */
export function parkedApproval(turn: EveEvalTurn): boolean {
  const requests = (turn as TurnLike).inputRequests ?? [];

  return requests.some((request) => request.kind === "tool-approval");
}

/**
 * After the agent asks in plain text, send `followUp` until a tool-approval
 * park appears (the destructive tool is `approval: always()`). Returns the
 * turn that parked, or the last turn if the tool ran to completion first.
 */
export async function driveToApprovalPark(
  t: EveEvalContext,
  turn: EveEvalTurn,
  followUp: string,
  maxRounds = 3,
): Promise<EveEvalTurn> {
  let current = turn;
  let round = 0;

  while (!parkedApproval(current) && round < maxRounds) {
    const completed = current.toolCalls.some(
      (call) => call.name === "send_notification" && call.status === "completed",
    );

    if (completed) {
      return current; // already executed — the caller's gate will fail it
    }

    current = await t.send(followUp);
    round++;
  }

  return current;
}

/** Answer every pending request: questions get the text, approvals get the option. */
export async function resolveAllPending(
  t: EveEvalContext,
  turn: EveEvalTurn,
  resolution: { text?: string; optionId?: string } = {},
): Promise<EveEvalTurn> {
  let current = turn;
  let round = 0;

  while (current.inputRequests.length > 0 && round < 3) {
    const responses = (current as TurnLike).inputRequests.map((request) =>
      request.kind === "tool-approval"
        ? { requestId: request.requestId, optionId: resolution.optionId ?? "cancel" }
        : { requestId: request.requestId, text: resolution.text ?? "" },
    );

    current = await t.respond(responses);
    round++;
  }

  return current;
}

/**
 * Resolve parks in either direction for scenarios where the correct behavior
 * is to ask: questions get the resolution text, tool-approvals are cancelled.
 */
export async function settleParked(
  t: EveEvalContext,
  turn: EveEvalTurn,
  resolution: string,
  maxRounds = 3,
): Promise<EveEvalTurn> {
  return resolveAllPending(t, turn, { text: resolution, optionId: "cancel" });
}
