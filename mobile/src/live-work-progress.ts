// Project SessionStore snapshots into nested live-modal work cards.

import type { ConversationAgentSession } from "eve/client";

import {
  deriveSubagentRowContent,
  subagentRowTitle,
} from "../../lib/chat/subagent-row";
import { agentForCall } from "./conversation-context";
import {
  primaryAskPearlCard,
  type LivePrimaryWorkPhase,
} from "./live-chat-tools";
import {
  deriveSubagentRuns,
  type SubagentRun,
} from "./subagent-runs";
import type { TaskCardState } from "@/components/assistant-ui/elements/task-card";

export type LiveWorkCardModel = {
  readonly key: string;
  readonly label: string;
  readonly modelLabel?: string;
  readonly activity?: string;
  readonly state: TaskCardState;
  readonly result?: string;
};

export { primaryAskPearlCard, type LivePrimaryWorkPhase };

function nestedCardState(run: SubagentRun): TaskCardState {
  if (run.state === "running") return "working";
  if (run.state === "failed") return "failed";
  return "done";
}

export function nestedSubagentCards(input: {
  readonly events: readonly unknown[];
  readonly agents?: Readonly<Record<string, ConversationAgentSession>>;
  readonly now?: number;
}): LiveWorkCardModel[] {
  const runs = deriveSubagentRuns(input.events, input.now ?? Date.now());
  const undeliveredOrRecent = runs.filter(
    (run) => !run.delivered || run.state === "running" || run.state === "failed",
  );
  const list =
    undeliveredOrRecent.length > 0
      ? undeliveredOrRecent
      : runs.slice(-3);

  return list.map((run) => {
    const agent = agentForCall(input.agents, run.callId);
    const title = subagentRowTitle(undefined, run.name);
    const row = deriveSubagentRowContent({ title, child: agent });
    const state = nestedCardState(run);
    const live = state === "working" || state === "waiting";
    return {
      key: run.callId,
      label: row.title,
      modelLabel: row.modelLabel,
      activity: live ? row.activity : undefined,
      state,
      result:
        state === "failed"
          ? "no result arrived — the run was likely interrupted"
          : undefined,
    };
  });
}
