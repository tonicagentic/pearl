import type { ApprovalPolicy } from "eve/tools/approval";

import { isPlanMode } from "./turn-context.ts";

/** Strip eve's `<connection>__` prefix from a qualified MCP tool name. */
export function bareConnectionToolName(toolName: string): string {
  const index = toolName.lastIndexOf("__");
  return index === -1 ? toolName : toolName.slice(index + 2);
}

export type WriteApprovalDeps = {
  /** Injectable for unit tests; production reads the turn's client intent. */
  readonly planMode?: () => boolean;
};

function readPlanMode(): boolean {
  try {
    return isPlanMode();
  } catch {
    // Turn state unreadable: fall through to approval, which still blocks
    // the write until a person confirms it.
    return false;
  }
}

/**
 * Connection `approval` policy for MCP connections that mix reads and writes.
 *
 * - Names in `writeTools` ask a person every call (never remembered), and are
 *   denied outright in plan mode — plan mode may research and write a plan,
 *   nothing else.
 * - Everything else (the connection's read tools) runs without a prompt.
 *
 * Match is on the bare tool name because eve qualifies connection tools as
 * `<connection>__<tool>`.
 */
export function writeToolApproval(
  writeTools: readonly string[],
  deps: WriteApprovalDeps = {},
): ApprovalPolicy {
  const writes = new Set(writeTools);
  const planMode = deps.planMode ?? readPlanMode;

  return ({ toolName }) => {
    const bare = bareConnectionToolName(toolName);
    if (!writes.has(bare)) return "not-applicable";
    if (planMode()) {
      return {
        type: "denied",
        reason:
          `Plan mode cannot call ${bare}. Write or update a plan with save_plan, ` +
          "or switch to Agent mode to carry the work out.",
      };
    }
    return "user-approval";
  };
}
