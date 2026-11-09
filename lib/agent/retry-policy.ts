// Timeout/retry taxonomy for every authored tool.
//
// eve does not retry tools itself and gives authored tools no retry-policy
// primitive (see node_modules/eve/docs/tools/overview.mdx: "Authored tools
// have no public terminal-error class or retry policy"). The framework does
// replay interrupted workflow steps, so each tool MUST declare whether its
// side effect is safe to retry, and non-idempotent tools must never be
// auto-retried without a status check. This table is that declaration, and
// tests/retry-taxonomy.test.ts enforces it against the real tool files.

export type RetryPolicy = {
  /**
   * true — replaying the operation cannot double the side effect (pure reads,
   * idempotency-keyed writes). false — a retry without a status check may
   * double the effect.
   */
  readonly idempotent: boolean;
  /** What failures may be retried automatically. */
  readonly retryOn: readonly ("network" | "5xx" | "timeout")[];
  /** Upper bound for automatic attempts (only meaningful when idempotent). */
  readonly maxAttempts: number;
  /** Why this policy holds — printed by failing tests. */
  readonly rationale: string;
};

const policy = (
  idempotent: boolean,
  retryOn: RetryPolicy["retryOn"],
  maxAttempts: number,
  rationale: string,
): RetryPolicy => ({ idempotent, retryOn, maxAttempts, rationale });

export const TOOL_RETRY_POLICIES: Readonly<Record<string, RetryPolicy>> = {
  // eve framework-managed tools (fileMemory provider): reads/writes on the
  // memory document, replay-safe via optimistic versioning and no-op dedupe.
  file__save_memory: policy(true, ["network", "timeout"], 2, "Framework memory write; identical saves are a documented no-op."),
  file__remove_memory: policy(true, ["network", "timeout"], 2, "Framework memory removal by stable index; idempotent."),
  // Reads and idempotency-keyed operations: safe to retry.
  get_weather: policy(true, ["network", "timeout"], 2, "Static read, no side effect."),
  read_attachment: policy(true, ["network", "timeout"], 2, "DB read, no side effect."),
  confirm_step: policy(
    true,
    ["timeout"],
    2,
    "Approval-gated echo with no side effect; an identical retry returns the same summary.",
  ),
  send_notification: policy(
    false,
    [],
    1,
    "External side effect; retries require a delivery status check via the execution ledger, never a blind re-send.",
  ),
  exa_agent_run: policy(
    false,
    [],
    1,
    "Starts a billed Exa agent run; the polling phase is idempotent but a replay of the start call would double-bill.",
  ),
  browser: policy(
    false,
    [],
    1,
    "Live browser actions (click, type, navigate) mutate page state; a blind retry can double-submit or click twice. Re-snapshot and decide again.",
  ),
  write_file: policy(
    false,
    [],
    1,
    "Sandbox file write is last-write-wins but can interleave with user edits; retried writes must re-read first.",
  ),
  edit_file: policy(
    false,
    [],
    1,
    "Span replacement is not safe to blind-retry: a re-run after a partial success could double-apply the edit; re-read the file and recompute the span.",
  ),
  // Content-agent tools (ported from eve-content-agent-template).
  lint_against_style: policy(
    true,
    ["network", "timeout"],
    2,
    "Pure read: skill reference file plus in-memory regex scan, no side effect.",
  ),
  get_writer_preferences: policy(
    true,
    ["network", "timeout"],
    2,
    "Blob read of the caller's own preferences, no side effect.",
  ),
  save_writer_preferences: policy(
    true,
    ["network", "timeout"],
    2,
    "Principal-scoped write is last-write-wins; an identical retry stores identical content.",
  ),
  clear_writer_preferences: policy(
    false,
    [],
    1,
    "Destructive (approval-gated): a retried clear must do a status check that the preferences are already gone, never blind-delete again.",
  ),
  upload_asset: policy(
    false,
    [],
    1,
    "Blob upload with a random suffix: a blind retry would double the object; retry only after checking whether the first upload landed.",
  ),
  generate_image: policy(
    false,
    [],
    1,
    "Starts a billed image generation and Blob upload; a blind retry would double the spend and the object — retry only after a status check.",
  ),
  render_design: policy(
    false,
    [],
    1,
    "Spins up a Vercel Sandbox and uploads a PDF/SVG; a blind retry would double sandbox cost and Blob objects — retry only after checking the first result.",
  ),
  sync_turn_intent: policy(
    true,
    ["timeout"],
    2,
    "In-memory turn intent sync with no external side effect; identical retries are a no-op.",
  ),
  create_project: policy(
    false,
    [],
    1,
    "Creating twice would duplicate the project; a retry must re-read the project list first instead of blind-inserting.",
  ),
  list_plans: policy(
    true,
    ["network", "timeout"],
    2,
    "DB read of project plans, no side effect.",
  ),
  read_plan: policy(
    true,
    ["network", "timeout"],
    2,
    "DB read of one plan row, no side effect.",
  ),
  save_plan: policy(
    true,
    ["network", "timeout"],
    2,
    "Plan upsert is last-write-wins by slug; an identical retry stores identical content.",
  ),
  builder: policy(
    false,
    [],
    1,
    "Subagent delegation spawns a durable child run; a replay would double the run — resume via status check instead.",
  ),
  editor: policy(
    false,
    [],
    1,
    "Subagent delegation spawns a durable child run; a replay would double the run — resume via status check instead.",
  ),
  list_assets: policy(
    true,
    ["network", "timeout"],
    2,
    "Blob listing read, no side effect.",
  ),
  list_artifacts: policy(
    true,
    ["network", "timeout"],
    2,
    "Principal-scoped Blob listing read, no side effect.",
  ),
  restore_artifact: policy(
    true,
    ["network", "timeout"],
    2,
    "Restores a stored artifact into the sandbox; the sandbox write is idempotent for identical content.",
  ),
  get_asset_info: policy(
    true,
    ["network", "timeout"],
    2,
    "Blob metadata read, no side effect.",
  ),
  download_asset: policy(
    true,
    ["network", "timeout"],
    2,
    "Blob content read (URL-restricted), no side effect.",
  ),
  delete_asset: policy(
    false,
    [],
    1,
    "Deletion is approval-gated: a retried delete must status check existence first; deleting twice would also hit the second asset if ids shifted.",
  ),
  // Issues (docs/issues-areas-plan.md).
  list_issues: policy(
    true,
    ["network", "timeout"],
    2,
    "DB read, no side effect.",
  ),
  create_issue: policy(
    false,
    [],
    1,
    "Capturing twice would duplicate the open loop; a retry must re-read the issue list first (status check) instead of blind-inserting.",
  ),
  resolve_issue: policy(
    false,
    [],
    1,
    "Resolution is approval-gated; a retried resolve must status check that the issue is still open first — never blind-settle again.",
  ),
  // User-scoped skills (settings + agent tools).
  list_skills: policy(
    true,
    ["network", "timeout"],
    2,
    "DB read of the caller's own skills, no side effect.",
  ),
  get_skill: policy(
    true,
    ["network", "timeout"],
    2,
    "DB read of one skill row, no side effect.",
  ),
  create_skill: policy(
    false,
    [],
    1,
    "Creating twice would duplicate the skill slug; a retry must re-read the skill list first (status check) instead of blind-inserting.",
  ),
  update_skill: policy(
    false,
    [],
    1,
    "Skill writes change agent behavior afterward; a retried update must re-read the current row first — never blind-overwrite again.",
  ),
  delete_skill: policy(
    false,
    [],
    1,
    "Deletion is approval-gated: a retried delete must status check existence first; deleting twice would also hit the wrong row if ids shifted.",
  ),
  // Structured identity profile (Settings → Identity).
  get_profile: policy(
    true,
    ["network", "timeout"],
    2,
    "DB read of the caller's own identity profile, no side effect.",
  ),
  // Declared subagents (agent/subagents/<name>/): the delegation call itself
  // is a background task spawn.
  coder: policy(
    false,
    [],
    1,
    "Coder delegation opens a durable sandbox task; a replay would spawn a second coding run — continue with taskId instead.",
  ),
  reviewer: policy(
    false,
    [],
    1,
    "Subagent delegation spawns a durable child run; a replay would double the run — resume via status check instead.",
  ),
  researcher: policy(
    false,
    [],
    1,
    "Subagent delegation spawns a durable child run; a replay would double the run and the research spend — resume via status check instead.",
  ),
  // Coder HITL tools (agent/subagents/coder/tools/) — referenced from
  // instructions and the UI; keep taxonomy coverage for ship actions.
  deploy_vercel: policy(
    false,
    [],
    1,
    "Approval-gated deploy; a blind retry can create a second deployment — check the first URL first.",
  ),
  merge_pr: policy(
    false,
    [],
    1,
    "Approval-gated squash merge; never blind-retry — re-read PR state first.",
  ),
  eas_build: policy(
    false,
    [],
    1,
    "Approval-gated Expo build start; a replay would queue a second Mac build.",
  ),
  eas_submit: policy(
    false,
    [],
    1,
    "Approval-gated store/TestFlight submit; never blind-retry a submit.",
  ),
  run_with_env: policy(
    false,
    [],
    1,
    "Approval-gated command with injected secrets; a replay can double side effects.",
  ),
  preview_check: policy(
    true,
    ["network", "timeout"],
    2,
    "HTTP status / screenshot read of a public URL, no mutating side effect.",
  ),
  deployment_logs: policy(
    true,
    ["network", "timeout"],
    2,
    "Read-only Vercel log fetch, no side effect.",
  ),
};

export function policyFor(toolName: string): RetryPolicy | undefined {
  return TOOL_RETRY_POLICIES[toolName];
}

/** Whether an automatic retry without a status check is allowed. */
export function mayAutoRetry(toolName: string): boolean {
  return policyFor(toolName)?.idempotent === true;
}
