import { buildAccountsPayload } from "@/lib/finance/api-v1";
import { withUserDb } from "@/lib/finance/db";
import { getPlaidEnv, plaidConfigured } from "@/lib/finance/plaid";
import { linkSandboxBank } from "@/lib/finance/plaid-sandbox";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";

/** One-click First Platypus Bank — sandbox only. */
export async function POST(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;

  if (!plaidConfigured()) {
    return Response.json(
      { error: "Plaid is not configured", env: getPlaidEnv() },
      { status: 503 },
    );
  }

  if (getPlaidEnv() !== "sandbox") {
    return Response.json(
      {
        error: "Sandbox bank link is only available when PLAID_ENV=sandbox.",
        env: getPlaidEnv(),
      },
      { status: 403 },
    );
  }

  return withUserDb(session.user.id, async () => {
    try {
      const body = (await request.json()) as { entityId?: string };
      if (!body.entityId?.trim()) {
        return Response.json(
          { error: "entityId is required" },
          { status: 400 },
        );
      }

      const result = await linkSandboxBank({
        entityId: body.entityId.trim(),
      });
      if ("error" in result) {
        return Response.json(result, { status: 400 });
      }

      const payload = await buildAccountsPayload();
      return Response.json({
        itemId: result.itemId,
        feeds: payload.feeds,
        accounts: payload.accounts,
      });
    } catch (err) {
      return Response.json(
        {
          error: err instanceof Error ? err.message : "Sandbox link failed",
          env: getPlaidEnv(),
        },
        { status: 400 },
      );
    }
  });
}
