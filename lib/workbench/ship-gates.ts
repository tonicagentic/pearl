/**
 * Decide whether a git__gh-style command needs a first-push / draft-PR gate.
 * Later commits on the same branch in the same task stay ungated.
 */

export type ShipGateDecision =
  | { readonly needsApproval: false; readonly reason: "not-applicable" }
  | {
      readonly needsApproval: true;
      readonly action: "push" | "draft_pr";
      readonly reason: string;
    }
  | { readonly needsApproval: false; readonly reason: "already-approved-branch" };

export type ShipGateState = {
  /** Branches that already got a first-push approval in this task. */
  readonly approvedPushBranches: ReadonlySet<string>;
  /** True once a draft PR was approved in this task. */
  readonly draftPrApproved: boolean;
};

export function emptyShipGateState(): ShipGateState {
  return {
    approvedPushBranches: new Set(),
    draftPrApproved: false,
  };
}

/**
 * Parse a single `gh` / `git` argv string (space-separated, no shell metacharacters).
 */
export function classifyGitCommand(
  command: string,
  state: ShipGateState,
): ShipGateDecision {
  const parts = command.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { needsApproval: false, reason: "not-applicable" };
  }

  const head = parts[0];
  if (head === "git") {
    return classifyGit(parts.slice(1), state);
  }
  if (head === "gh") {
    return classifyGh(parts.slice(1), state);
  }
  return { needsApproval: false, reason: "not-applicable" };
}

function classifyGit(
  args: readonly string[],
  state: ShipGateState,
): ShipGateDecision {
  if (args[0] !== "push") {
    return { needsApproval: false, reason: "not-applicable" };
  }
  // git push [-u] <remote> <branch>
  let i = 1;
  while (i < args.length && args[i]!.startsWith("-")) {
    i += 1;
  }
  const remote = args[i] ?? "origin";
  const branch = args[i + 1] ?? "";
  const key = `${remote}/${branch || "HEAD"}`;
  if (state.approvedPushBranches.has(key) || state.approvedPushBranches.has(branch)) {
    return { needsApproval: false, reason: "already-approved-branch" };
  }
  return {
    needsApproval: true,
    action: "push",
    reason: `First push of ${branch || "HEAD"} needs approval.`,
  };
}

function classifyGh(
  args: readonly string[],
  state: ShipGateState,
): ShipGateDecision {
  // gh pr create [--draft]
  if (args[0] === "pr" && args[1] === "create") {
    const isDraft =
      args.includes("--draft") ||
      args.some((a) => a === "-d") ||
      args.includes("--draft=true");
    if (!isDraft) {
      // Non-draft create still gated as draft_pr for Pearl policy (always draft).
      return {
        needsApproval: true,
        action: "draft_pr",
        reason: "Opening a pull request needs approval (use --draft).",
      };
    }
    if (state.draftPrApproved) {
      return { needsApproval: false, reason: "already-approved-branch" };
    }
    return {
      needsApproval: true,
      action: "draft_pr",
      reason: "First draft PR needs approval.",
    };
  }
  return { needsApproval: false, reason: "not-applicable" };
}

export function rememberPushApproval(
  state: ShipGateState,
  branchKey: string,
): ShipGateState {
  const next = new Set(state.approvedPushBranches);
  next.add(branchKey);
  return { ...state, approvedPushBranches: next };
}

export function rememberDraftPrApproval(state: ShipGateState): ShipGateState {
  return { ...state, draftPrApproved: true };
}
