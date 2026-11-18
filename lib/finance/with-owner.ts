import { inUserDb, withUserDb } from "@/lib/finance/db";
import { requireOwnerSession, UnauthorizedError } from "@/lib/finance/session";

/**
 * Run `fn` inside a transaction scoped to the signed-in owner (RLS `app.user_id`).
 * Pass the Route Handler `request` so Bearer/cookie auth resolves on Pearl.
 */
export async function withOwnerDb<T>(
  request: Request,
  fn: () => Promise<T>,
): Promise<T> {
  if (inUserDb()) return fn();
  if (!request) throw new UnauthorizedError();
  const session = await requireOwnerSession(request);
  return withUserDb(session.user.id, fn);
}
