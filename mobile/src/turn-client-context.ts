// Build ephemeral clientContext for mobile sends (mode, project, models, agent).

import {
  CHAT_ID_MARKER,
  CUSTOM_AGENT_ID_MARKER,
  MODE_MARKER,
  PROJECT_ID_MARKER,
  REMOTE_AGENT_ID_MARKER,
} from "../../lib/agent-mode-context";
import { getAgentMode } from "./agent-mode";
import { modelClientContext } from "./model-selection";
import { getRemoteAgentSelection } from "./remote-agent-selection";

export function buildTurnClientContext(
  projectId?: string | null,
  chatId?: string | null,
  customAgentId?: string | null,
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
  if (customAgentId) {
    clientContext[CUSTOM_AGENT_ID_MARKER] = customAgentId;
  }
  const remoteAgentId = getRemoteAgentSelection();
  if (remoteAgentId) {
    clientContext[REMOTE_AGENT_ID_MARKER] = remoteAgentId;
  }
  return clientContext;
}
