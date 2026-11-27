import type { EveEvalTurn } from "eve/evals";

import { pendingRequests } from "../behavior/parked.ts";

/**
 * Settle an ask_question park (text or option) without approving create_goal.
 * Approvals get deny so the walkthrough cannot save mid-conversation.
 */
export async function answerQuestion(
  turn: EveEvalTurn,
  resolution: { readonly text?: string; readonly optionId?: string },
): Promise<EveEvalTurn> {
  const pending = pendingRequests(turn);
  if (pending.length === 0) return turn;

  const answers = pending.map((interaction) =>
    interaction.request.kind === "approval" ||
    interaction.request.kind === "budget"
      ? {
          interactionId: interaction.interactionId,
          optionId: "deny",
        }
      : {
          interactionId: interaction.interactionId,
          text: resolution.text ?? "",
          ...(resolution.optionId
            ? { optionId: resolution.optionId }
            : {}),
        },
  );

  return turn.session.respond(answers);
}

/** Reply text, or the latest park / create_goal payload when the turn has no prose. */
export function turnVisibleText(turn: EveEvalTurn): string {
  const reply = (turn.reply ?? "").trim();
  if (reply) return reply;

  for (const interaction of pendingRequests(turn)) {
    if (interaction.request.kind === "approval") {
      const prompt = (
        interaction.request as { readonly prompt?: string }
      ).prompt?.trim();
      if (prompt) return prompt;
    }
  }

  const questions = pendingRequests(turn).filter(
    (interaction) => interaction.request.kind === "question",
  );
  if (questions.length > 0) {
    const latest = questions[questions.length - 1];
    const request = latest.request as {
      readonly prompt?: string;
      readonly question?: string;
    };
    const prompt = (request.prompt ?? request.question ?? "").trim();
    if (prompt) return prompt;
  }

  const creates = turn.toolCalls.filter((call) => call.name === "create_goal");
  if (creates.length > 0) {
    const input = creates[creates.length - 1].input as {
      readonly title?: string;
      readonly notes?: string | null;
      readonly targetDate?: string | null;
    };
    return [
      input.title ?? "",
      input.notes ? `Done looks like: ${input.notes}` : "",
      input.targetDate ? `Target: ${input.targetDate}` : "",
      "standalone",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const asks = turn.toolCalls.filter((call) => call.name === "ask_question");
  if (asks.length > 0) {
    const latest = asks[asks.length - 1];
    const input = latest.input as { readonly question?: string } | undefined;
    const question = input?.question?.trim();
    if (question) return question;
  }

  return reply;
}

/** Reply + parked question only — never tool args (those may name fields). */
export function userFacingText(turn: EveEvalTurn): string {
  const reply = (turn.reply ?? "").trim();
  const parts: string[] = [];
  if (reply) parts.push(reply);
  for (const interaction of pendingRequests(turn)) {
    if (interaction.request.kind !== "question") continue;
    const request = interaction.request as {
      readonly prompt?: string;
      readonly question?: string;
    };
    const prompt = (request.prompt ?? request.question ?? "").trim();
    if (prompt) parts.push(prompt);
  }
  return parts.join("\n");
}

export async function continueWalkthrough(
  turn: EveEvalTurn,
  session: EveEvalTurn["session"],
  text: string,
): Promise<EveEvalTurn> {
  if (pendingRequests(turn).length > 0) {
    return answerQuestion(turn, { text });
  }
  return session.send(text);
}
