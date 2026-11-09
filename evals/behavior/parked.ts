import type { EveEvalTurn } from "eve/evals";

// Eval-side tolerance for the two valid confirmation styles: the agent may
// park a tool-approval request (durable HITL) or ask for confirmation in
// plain text. These helpers settle either style deterministically.
//
// Every turn carries its session, so follow-up messages and answers go
// through `turn.session` and stay in the same conversation.

/** True when the turn parked on a tool-approval request. */
export function parkedApproval(turn: EveEvalTurn): boolean {
  return turn.session.pendingInteractions.some(
    (interaction) => interaction.request.kind === "approval",
  );
}

/** Requests the session still waits on, excluding sign-ins (those take no answer). */
export function pendingRequests(turn: EveEvalTurn) {
  return turn.session.pendingInteractions.filter(
    (interaction) => interaction.request.kind !== "sign-in",
  );
}

/**
 * After the agent asks in plain text, send `followUp` until a tool-approval
 * park appears (the destructive tool is `approval: always()`). Returns the
 * turn that parked, or the last turn if the tool ran to completion first.
 */
export async function driveToApprovalPark(
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

    current = await current.session.send(followUp);
    round++;
  }

  return current;
}

/** Answer every pending request: questions get the text, approvals get the option. */
export async function resolveAllPending(
  turn: EveEvalTurn,
  resolution: { text?: string; optionId?: string } = {},
): Promise<EveEvalTurn> {
  let current = turn;
  let round = 0;

  while (pendingRequests(current).length > 0 && round < 3) {
    const answers = pendingRequests(current).map((interaction) =>
      interaction.request.kind === "approval" ||
      interaction.request.kind === "budget"
        ? {
            interactionId: interaction.interactionId,
            optionId: resolution.optionId ?? "deny",
          }
        : {
            interactionId: interaction.interactionId,
            text: resolution.text ?? "",
          },
    );

    current = await current.session.respond(answers);
    round++;
  }

  return current;
}

/**
 * Resolve parks in either direction for scenarios where the correct behavior
 * is to ask: questions get the resolution text, tool-approvals are denied.
 */
export async function settleParked(
  turn: EveEvalTurn,
  resolution: string,
  maxRounds = 3,
): Promise<EveEvalTurn> {
  void maxRounds;
  return resolveAllPending(turn, { text: resolution, optionId: "deny" });
}
