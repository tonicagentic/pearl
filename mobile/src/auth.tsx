import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { fetchBillingStatus } from "./billing-client";
import { AGENT_URL, getAuthCookie, setAuthCookie } from "./eve-transport";
import {
  clearSession,
  loadSession,
  onSessionInvalid,
  saveSession,
} from "./session-store";
import { unregisterForPushNotifications } from "./push-notifications";

export type SignInState = "idle" | "signing-in" | "error";

/** Window-relative frame of the auth CTA used to morph into the composer. */
export type AuthCtaFrame = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type AuthHandOff = {
  readonly from: AuthCtaFrame;
};

type AuthContextValue = {
  readonly signedIn: boolean;
  /** Email of the signed-in account. */
  readonly viewerEmail: string | null;
  /** True while the Keychain session is being restored on cold start. */
  readonly restoring: boolean;
  /**
   * False until billing status says the user may chat (free pass, active
   * subscription, or billing disabled on the deployment).
   */
  readonly billingReady: boolean;
  /**
   * Set only after an interactive sign-in / sign-up so the gate can morph the
   * CTA into the composer. Cold-start restore never sets this.
   */
  readonly authHandOff: AuthHandOff | null;
  readonly signInState: SignInState;
  readonly signInError: string | null;
  readonly signIn: (
    email: string,
    password: string,
    handOffFrom?: AuthCtaFrame | null,
  ) => Promise<void>;
  readonly signUp: (
    email: string,
    password: string,
    handOffFrom?: AuthCtaFrame | null,
  ) => Promise<void>;
  readonly completeAuthHandOff: () => void;
  readonly markBillingReady: () => void;
  readonly signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Auth gate shared by every route: the sign-in screen, the chat, and the
 * issues screen all read the same state, and the session cookie set here is
 * what the eve transport and the /api/issues client send.
 *
 * The cookie is mirrored into the device Keychain (session-store.ts) so the
 * session survives app restarts; a stored cookie that starts failing with 401
 * (server-side expiry) clears both copies via the invalidation listener.
 */
export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  const [viewerEmail, setViewerEmail] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [billingReady, setBillingReady] = useState(true);
  const [authHandOff, setAuthHandOff] = useState<AuthHandOff | null>(null);
  const [signInState, setSignInState] = useState<SignInState>("idle");
  const [signInError, setSignInError] = useState<string | null>(null);

  const refreshBillingGate = useCallback(async () => {
    try {
      const status = await fetchBillingStatus();
      if (!status || !status.enabled) {
        setBillingReady(true);
        return;
      }
      setBillingReady(Boolean(status.exempt || status.allowed));
    } catch {
      // If status cannot be loaded, let the server turn gate decide.
      setBillingReady(true);
    }
  }, []);

  // Cold-start restore: pick the stored session back up before rendering the
  // gate, so a signed-in user lands straight in the chat.
  useEffect(() => {
    let cancelled = false;

    void loadSession()
      .then(async (session) => {
        if (cancelled || !session) {
          return;
        }

        setAuthCookie(session.cookie);
        setViewerEmail(session.email || null);
        setSignedIn(true);
        await refreshBillingGate();
      })
      .catch(() => {
        // Corrupt or unreadable storage: fall through to the sign-in screen.
      })
      .finally(() => {
        if (!cancelled) {
          setRestoring(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refreshBillingGate]);

  const commitSession = useCallback(
    async (
      credential: string,
      email: string,
      handOffFrom?: AuthCtaFrame | null,
    ) => {
      await saveSession(credential, email);
      setAuthCookie(credential);
      setViewerEmail(email);
      setSignInState("idle");
      await refreshBillingGate();
      if (handOffFrom) {
        setAuthHandOff({ from: handOffFrom });
      }
      setSignedIn(true);
    },
    [refreshBillingGate],
  );

  const requestToken = useCallback(
    async (
      path: "sign-in/email" | "sign-up/email",
      email: string,
      password: string,
    ): Promise<string> => {
      const timeout = AbortSignal.timeout(45_000);
      const response = await fetch(`${AGENT_URL}/api/auth/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, name: email.split("@")[0] }),
        signal: timeout,
      });
      const body = (await response.json().catch(() => null)) as {
        token?: string;
        message?: string;
        error?: { message?: string } | string;
      } | null;
      // RN fetch cannot read Set-Cookie (iOS strips it from the header map),
      // so the credential comes from the response body via better-auth's
      // bearer plugin on the server.
      const credential = body?.token;

      if (!response.ok || !credential) {
        const detail =
          (typeof body?.error === "string"
            ? body.error
            : body?.error?.message) ??
          body?.message ??
          (body ? JSON.stringify(body).slice(0, 160) : "");
        throw new Error(
          detail ||
            `${path.startsWith("sign-up") ? "Sign-up" : "Sign-in"} failed (${response.status}).`,
        );
      }

      return credential;
    },
    [],
  );

  const signIn = useCallback(
    async (
      email: string,
      password: string,
      handOffFrom?: AuthCtaFrame | null,
    ) => {
      setSignInState("signing-in");
      setSignInError(null);

      try {
        const credential = await requestToken("sign-in/email", email, password);
        await commitSession(credential, email, handOffFrom);
      } catch (cause) {
        setSignInState("error");
        const message = cause instanceof Error ? cause.message : String(cause);
        setSignInError(
          message.toLowerCase().includes("abort")
            ? "Can't reach Pearl. Check your connection and try again."
            : message,
        );
      }
    },
    [commitSession, requestToken],
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      handOffFrom?: AuthCtaFrame | null,
    ) => {
      setSignInState("signing-in");
      setSignInError(null);

      try {
        const timeout = AbortSignal.timeout(45_000);
        const response = await fetch(`${AGENT_URL}/api/auth/sign-up/email`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            name: email.split("@")[0],
          }),
          signal: timeout,
        });
        const body = (await response.json().catch(() => null)) as {
          token?: string;
          message?: string;
          error?: { message?: string } | string;
        } | null;

        if (!response.ok) {
          const detail =
            (typeof body?.error === "string"
              ? body.error
              : body?.error?.message) ??
            body?.message ??
            (body ? JSON.stringify(body).slice(0, 160) : "");
          throw new Error(detail || `Sign-up failed (${response.status}).`);
        }

        // Prefer a bearer token from sign-up; otherwise sign in immediately.
        const credential =
          body?.token ??
          (await requestToken("sign-in/email", email, password));
        await commitSession(credential, email, handOffFrom);
      } catch (cause) {
        setSignInState("error");
        const message = cause instanceof Error ? cause.message : String(cause);
        setSignInError(
          message.toLowerCase().includes("abort")
            ? "Can't reach Pearl. Check your connection and try again."
            : message,
        );
      }
    },
    [commitSession, requestToken],
  );

  const completeAuthHandOff = useCallback(() => {
    setAuthHandOff(null);
  }, []);

  const markBillingReady = useCallback(() => {
    setBillingReady(true);
  }, []);

  const signOut = useCallback(() => {
    const credential = getAuthCookie();
    void unregisterForPushNotifications(credential);
    setAuthCookie(null);
    void clearSession();
    setViewerEmail(null);
    setAuthHandOff(null);
    setSignInState("idle");
    setSignInError(null);
    setBillingReady(true);
    setSignedIn(false);
  }, []);
  // Keep the invalidation listener in sync without writing to a ref in render.
  useEffect(() => onSessionInvalid(signOut), [signOut]);

  const value = useMemo(
    () => ({
      signedIn,
      viewerEmail,
      restoring,
      billingReady,
      authHandOff,
      signInState,
      signInError,
      signIn,
      signUp,
      completeAuthHandOff,
      markBillingReady,
      signOut,
    }),
    [
      signedIn,
      viewerEmail,
      restoring,
      billingReady,
      authHandOff,
      signInState,
      signInError,
      signIn,
      signUp,
      completeAuthHandOff,
      markBillingReady,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
