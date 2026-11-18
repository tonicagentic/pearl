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

function ownerEmail() {
  return process.env.PEARL_OWNER_EMAIL?.trim().toLowerCase() ?? "";
}

/**
 * Resolve the caller from Pearl's better-auth session on this request
 * (cookie or Bearer). Optionally restrict to PEARL_OWNER_EMAIL.
 */
export async function resolvePearlSession(
  request: Request,
): Promise<PearlSession | null> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    if (!session?.user?.email || !session.session) return null;

    const owner = ownerEmail();
    if (
      owner &&
      session.user.email.trim().toLowerCase() !== owner
    ) {
      return null;
    }

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
  } catch (error) {
    console.error("Failed to resolve Pearl finance session:", error);
    return null;
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export async function requireOwnerSession(
  request: Request,
): Promise<PearlSession> {
  const session = await resolvePearlSession(request);
  if (!session) throw new UnauthorizedError();
  return session;
}

export async function requirePearlSession(
  request: Request,
): Promise<PearlSession | Response> {
  const session = await resolvePearlSession(request);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}

export function isPearlSession(
  value: PearlSession | Response,
): value is PearlSession {
  return !(value instanceof Response);
}
