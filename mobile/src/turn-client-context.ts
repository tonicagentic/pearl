// Build ephemeral clientContext for mobile sends (mode, project, models).

import {
  CHAT_ID_MARKER,
  MODE_MARKER,
  PROJECT_ID_MARKER,
} from "../../lib/agent-mode-context";
import { getAgentMode } from "./agent-mode";
import { modelClientContext } from "./model-selection";

export function buildTurnClientContext(
  projectId?: string | null,
  chatId?: string | null,
): Record<string, string> {
  const clientContext: Record<string, string> = {
    [MODE_MARKER]: getAgentMode(),
    ...modelClientContext(),
  };
  if (projectId) {
    clientContext[PROJECT_ID_MARKER] = projectId;
  }
  if (chatId) {
    clientContext[CHAT_ID_MARKER] = chatId;
  }
  return clientContext;
}
