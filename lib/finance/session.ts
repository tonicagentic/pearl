import { auth } from "@/lib/auth";

export type PearlUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

export type PearlSession = {
  session: {
    id: string;
    token: string;
    userId: string;
    expiresAt: string | Date;
  };
  user: PearlUser;
};

function toPearlSession(session: {
  session: {
    id: string;
    token: string;
    userId: string;
    expiresAt: string | Date;
  };
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
}): PearlSession {
  return {
    session: {
      id: session.session.id,
      token: session.session.token,
      userId: session.session.userId,
      expiresAt: session.session.expiresAt,
    },
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    },
  };
}

/**
 * Resolve the caller from Pearl's better-auth session on this request
 * (cookie or Bearer). Any signed-in user may use Finances; books stay
 * isolated per user via withUserDb / finance RLS.
 *
 * Returns null when there is no valid auth session.
 */
export async function resolvePearlSession(
  request: Request,
): Promise<PearlSession | null> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    if (!session?.user?.email || !session.session) return null;
    return toPearlSession(session);
  } catch (error) {
    console.error("Failed to resolve Pearl finance session:", error);
    return null;
  }
}

/**
 * Like resolvePearlSession, but distinguishes missing auth.
 * Kept for callers that previously checked owner mismatch; `forbidden` is
 * unused now that Finances is open to every signed-in user.
 */
export async function resolvePearlFinanceAccess(
  request: Request,
): Promise<
  | { readonly ok: true; readonly session: PearlSession }
  | { readonly ok: false; readonly reason: "unauthenticated" | "forbidden" }
> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    if (!session?.user?.email || !session.session) {
      return { ok: false, reason: "unauthenticated" };
    }
    return { ok: true, session: toPearlSession(session) };
  } catch (error) {
    console.error("Failed to resolve Pearl finance session:", error);
    return { ok: false, reason: "unauthenticated" };
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

export async function requireOwnerSession(
  request: Request,
): Promise<PearlSession> {
  const access = await resolvePearlFinanceAccess(request);
  if (!access.ok) {
    throw access.reason === "forbidden"
      ? new ForbiddenError()
      : new UnauthorizedError();
  }
  return access.session;
}

export async function requirePearlSession(
  request: Request,
): Promise<PearlSession | Response> {
  const access = await resolvePearlFinanceAccess(request);
  if (!access.ok) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return access.session;
}

export function isPearlSession(
  value: PearlSession | Response,
): value is PearlSession {
  return !(value instanceof Response);
}
