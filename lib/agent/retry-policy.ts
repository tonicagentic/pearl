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
  // Reads and idempotency-keyed operations: safe to retry.
  get_weather: policy(true, ["network", "timeout"], 2, "Static read, no side effect."),
  read_attachment: policy(true, ["network", "timeout"], 2, "DB read, no side effect."),
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
  write_file: policy(
    false,
    [],
    1,
    "Sandbox file write is last-write-wins but can interleave with user edits; retried writes must re-read first.",
  ),
};

export function policyFor(toolName: string): RetryPolicy | undefined {
  return TOOL_RETRY_POLICIES[toolName];
}

/** Whether an automatic retry without a status check is allowed. */
export function mayAutoRetry(toolName: string): boolean {
  return policyFor(toolName)?.idempotent === true;
}
