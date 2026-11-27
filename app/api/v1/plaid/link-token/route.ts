import { createLinkToken } from "@/lib/finance/plaid-link";
import { getPlaidEnv, plaidConfigured } from "@/lib/finance/plaid";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { withUserDb } from "@/lib/finance/db";

export async function POST(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;

  const env = getPlaidEnv();
  if (!plaidConfigured()) {
    return Response.json(
      { error: "Plaid is not configured", env, sandbox: env === "sandbox" },
      { status: 503 },
    );
  }

  return withUserDb(session.user.id, async () => {
    let body: { plaidItemId?: string } = {};
    try {
      body = (await request.json()) as { plaidItemId?: string };
    } catch {
      // empty body is fine for new Link
    }

    const result = await createLinkToken({
      userId: session.user.id,
      plaidItemId: body.plaidItemId ?? null,
    });

    if ("error" in result && result.error) {
      return Response.json(
        { ...result, sandbox: result.env === "sandbox" },
        { status: 400 },
      );
    }
    return Response.json({
      ...result,
      sandbox: result.env === "sandbox",
    });
  });
}
