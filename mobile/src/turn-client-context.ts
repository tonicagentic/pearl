// Build ephemeral clientContext for mobile sends (mode, project, model).

import {
  MODE_MARKER,
  PROJECT_ID_MARKER,
} from "../../lib/agent-mode-context";
import { getAgentMode } from "./agent-mode";
import {
  DEFAULT_MODEL_KEY,
  getModelSelection,
} from "./model-selection";

export function buildTurnClientContext(
  projectId?: string | null,
): Record<string, string> {
  const mode = getAgentMode();
  const clientContext: Record<string, string> = {
    [MODE_MARKER]: mode,
  };
  if (projectId) {
    clientContext[PROJECT_ID_MARKER] = projectId;
  }
  const modelKey = getModelSelection();
  if (modelKey !== DEFAULT_MODEL_KEY) {
    clientContext.eveModelSelection = modelKey;
  }
  return clientContext;
}
