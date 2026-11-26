import { errorSummary } from "../agent-debug-log";

/**
 * Single user-facing string for eve / transport / send failures.
 * Prefer this over stitching snapshot.error + connectionError + sendError ad hoc.
 */
export function formatEveClientError(input: {
  readonly storeError?: unknown;
  readonly connectionError?: string | null;
  readonly sendError?: string | null;
  readonly persistenceError?: string | null;
}): string | null {
  if (input.sendError) return input.sendError;
  if (input.connectionError) return input.connectionError;
  const fromStore = errorSummary(input.storeError);
  if (fromStore) return fromStore;
  if (input.persistenceError) return input.persistenceError;
  return null;
}
