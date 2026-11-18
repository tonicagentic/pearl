import { createLinkToken } from "@/lib/finance/plaid-link";
import { plaidConfigured } from "@/lib/finance/plaid";
import { isPearlSession, requirePearlSession } from "@/lib/finance/session";
import { withUserDb } from "@/lib/finance/db";

export async function POST(request: Request) {
  const session = await requirePearlSession(request);
  if (!isPearlSession(session)) return session;

  if (!plaidConfigured()) {
    return Response.json(
      { error: "Plaid is not configured", env: process.env.PLAID_ENV ?? "sandbox" },
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
      return Response.json(result, { status: 400 });
    }
    return Response.json(result);
  });
}
