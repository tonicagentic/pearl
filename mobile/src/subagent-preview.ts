import type { ConversationAgentSession, EveMessage } from "eve/client";

import {
  subagentMessageBlocks as sharedBlocks,
  subagentTranscriptLines as sharedLines,
} from "../../lib/chat/subagent-preview";

export {
  subagentMessageBlocks,
  subagentTranscriptLines,
} from "../../lib/chat/subagent-preview";

/** Latest visible line from a followed child session, or null when empty. */
export function latestSubagentPreviewLine(
  agent: ConversationAgentSession | undefined,
): string | null {
  if (!agent || agent.observation.status === "not-followed") return null;
  const lines = sharedLines(
    agent.observation.conversation.messages as readonly EveMessage[],
  );
  const last = lines[lines.length - 1];
  if (!last) return null;
  return last.length > 140 ? `${last.slice(0, 137).trimEnd()}…` : last;
}

/** Re-export typed for Eve messages (same implementation). */
export function subagentBlocksForEve(messages: readonly EveMessage[]) {
  return sharedBlocks(messages);
}
