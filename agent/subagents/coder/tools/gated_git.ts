import { defineTool } from "eve/tools";
import { z } from "zod";

import { requireCoderUserId } from "@/lib/coder/principal";
import { buildApprovalCard } from "@/lib/workbench/approvals";
import {
  classifyGitCommand,
  emptyShipGateState,
  rememberDraftPrApproval,
  rememberPushApproval,
  type ShipGateState,
} from "@/lib/workbench/ship-gates";

/**
 * Task-local ship-gate state. Eve may run tools across isolates; we keep a
 * best-effort in-memory map keyed by session id for same-instance tasks.
 */
const gateBySession = new Map<string, ShipGateState>();

function stateFor(sessionId: string): ShipGateState {
  const existing = gateBySession.get(sessionId);
  if (existing) return existing;
  const fresh = emptyShipGateState();
  gateBySession.set(sessionId, fresh);
  return fresh;
}

/**
 * Classify a git/gh command and require approval for the first push and the
 * first draft PR in a task. Prefer git__gh for the actual authenticated run
 * after this gate returns ok — or pass runViaSandbox=false and only use this
 * as a preflight. When needsApproval would be true, eve's always() gate parks
 * for the human first.
 *
 * This tool itself always asks for approval when the command is a first push
 * or draft PR; for other commands it returns not-applicable immediately.
 */
export default defineTool({
  approval: async ({ toolInput }) => {
    const command =
      typeof toolInput === "object" &&
      toolInput &&
      "command" in toolInput &&
      typeof (toolInput as { command?: unknown }).command === "string"
        ? (toolInput as { command: string }).command
        : "";
    const decision = classifyGitCommand(command, emptyShipGateState());
    if (decision.needsApproval) {
      return "user-approval";
    }
    return "not-applicable";
  },
  description:
    "Preflight for the first `git push` and first `gh pr create --draft` in " +
    "this task. Call before git__gh for those commands. Later pushes on an " +
    "already-approved branch, and later draft PRs after one approval, skip " +
    "the card. Does not run git itself — after approval, run the same " +
    "command with git__gh.",
  inputSchema: z.object({
    command: z
      .string()
      .min(1)
      .describe("The git or gh command you intend to run via git__gh."),
    owner: z.string().min(1),
    repo: z.string().min(1),
    branch: z.string().nullish(),
  }),
  async execute(input, ctx) {
    const auth = requireCoderUserId(ctx.session.auth.current);
    if ("error" in auth) return { status: "error", error: auth.error };

    const sessionId = ctx.session.id;
    let state = stateFor(sessionId);
    const decision = classifyGitCommand(input.command, state);

    if (!decision.needsApproval) {
      return {
        status: "ok",
        needsApproval: false,
        reason: decision.reason,
        proceedWith: "git__gh",
      };
    }

    const card = buildApprovalCard({
      action: decision.action,
      owner: input.owner,
      repo: input.repo,
      target: input.branch?.trim() || "HEAD",
    });

    if (decision.action === "push") {
      const key = input.branch?.trim()
        ? `origin/${input.branch.trim()}`
        : "origin/HEAD";
      state = rememberPushApproval(state, key);
      if (input.branch?.trim()) {
        state = rememberPushApproval(state, input.branch.trim());
      }
      gateBySession.set(sessionId, state);
    } else {
      state = rememberDraftPrApproval(state);
      gateBySession.set(sessionId, state);
    }

    return {
      status: "ok",
      needsApproval: true,
      action: decision.action,
      cardSummary: card.summary,
      proceedWith: "git__gh",
      note: "Approved. Run the same command with git__gh now.",
    };
  },
});
