export type EvalVerdict =
  | "passed"
  | "failed"
  | "scored"
  | "skipped"
  | "errored"
  | string;

export type EvalAssertion = {
  name: string;
  score: number;
  severity: "gate" | "soft" | string;
  threshold: number;
  passed: boolean;
  errored?: boolean;
  key?: string;
  message?: string;
  metadata?: Record<string, unknown>;
};

export type EvalRunSummary = {
  id: string;
  startedAt?: string;
  completedAt?: string;
  passed: number;
  failed: number;
  scored: number;
  skipped: number;
  errored: number;
  totalEvals: number;
  evals: Array<{
    id: string;
    verdict: EvalVerdict;
    status?: string;
    startedAt?: string;
    completedAt?: string;
  }>;
};

export type EvalTurn = {
  turnId: string;
  userText: string;
  replyText: string;
  tools: Array<{ name: string; status?: string }>;
  skills: string[];
};

export type EvalDetail = {
  id: string;
  runId: string;
  verdict: EvalVerdict;
  startedAt?: string;
  completedAt?: string;
  assertions: EvalAssertion[];
  reply: string;
  toolCalls: Array<{
    name: string;
    status?: string;
    turnIndex?: number;
    input?: unknown;
    output?: unknown;
  }>;
  skillLoads: Array<{ skill: string; turnIndex?: number }>;
  turns: EvalTurn[];
  usage?: unknown;
  models?: unknown;
};

/** Best-effort parse of eve soft-judge assertion messages. */
export function parseJudgeMessage(message: string | undefined): {
  input?: string;
  output?: string;
  instructions?: string;
  probability?: number;
} {
  if (!message) return {};
  try {
    const stateMatch = message.match(/state:\s*(\{[\s\S]*?\})\s*\nquestion:/);
    const questionMatch = message.match(
      /question:\s*(\{[\s\S]*?\})\s*\nanswer:/,
    );
    const answerMatch = message.match(/answer:\s*(\{[\s\S]*\})\s*$/);
    const state = stateMatch
      ? (JSON.parse(stateMatch[1]!) as { input?: string; output?: string })
      : null;
    const question = questionMatch
      ? (JSON.parse(questionMatch[1]!) as {
          instructions?: string;
        })
      : null;
    const answer = answerMatch
      ? (JSON.parse(answerMatch[1]!) as { probability?: number })
      : null;
    return {
      input: typeof state?.input === "string" ? state.input : undefined,
      output: typeof state?.output === "string" ? state.output : undefined,
      instructions:
        typeof question?.instructions === "string"
          ? question.instructions
          : undefined,
      probability:
        typeof answer?.probability === "number"
          ? answer.probability
          : undefined,
    };
  } catch {
    return {};
  }
}
