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
import {
  AGENT_URL,
  getAuthCookie,
  restoreAgentUrl,
  setAuthCookie,
} from "./eve-transport";
import {
  clearSession,
  loadSession,
  onSessionInvalid,
  saveSession,
} from "./session-store";
import {
  clearAppIconBadge,
  unregisterForPushNotifications,
} from "./push-notifications";

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
  /** better-auth `user.name` for the Profile initials / Account screen. */
  readonly viewerName: string | null;
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
  /** Returns true when the request was accepted (email may or may not exist). */
  readonly requestPasswordReset: (email: string) => Promise<boolean>;
  readonly resetPassword: (
    token: string,
    newPassword: string,
  ) => Promise<void>;
  /**
   * Whether this email already has an account. Used to route the email-first
   * gate into “Welcome back” (sign-in) vs create-password (sign-up).
   * Null when the probe fails — caller should keep the current flow.
   */
  readonly checkEmailExists: (email: string) => Promise<boolean | null>;
  readonly completeAuthHandOff: () => void;
  readonly markBillingReady: () => void;
  /** Updates the cached display name after Account saves. */
  readonly setViewerName: (name: string | null) => void;
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
type AuthTokenResult = {
  readonly credential: string | null;
  readonly name: string | null;
};

function nameFromAuthUser(user: unknown): string | null {
  if (!user || typeof user !== "object") return null;
  const name = (user as { name?: unknown }).name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  const [viewerEmail, setViewerEmail] = useState<string | null>(null);
  const [viewerName, setViewerName] = useState<string | null>(null);
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

  const refreshViewerName = useCallback(async (credential: string) => {
    try {
      const response = await fetch(`${AGENT_URL}/api/auth/get-session`, {
        method: "GET",
        headers: {
          authorization: `Bearer ${credential}`,
        },
        cache: "no-store",
      });
      if (!response.ok) return;
      const body = (await response.json().catch(() => null)) as {
        user?: unknown;
      } | null;
      const name = nameFromAuthUser(body?.user);
      if (name) setViewerName(name);
    } catch {
      // Initials fall back to the email local-part until name loads.
    }
  }, []);

  // Cold-start restore: agent URL first (so API calls hit the right host),
  // then the stored session, so a signed-in user lands straight in the chat.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await restoreAgentUrl();
        if (cancelled) return;
        const session = await loadSession();
        if (cancelled || !session) return;
        setAuthCookie(session.cookie);
        setViewerEmail(session.email || null);
        setSignedIn(true);
        await refreshBillingGate();
        // Name for initials — do not block restoring / home paint on this.
        if (!cancelled) {
          void refreshViewerName(session.cookie);
        }
      } catch {
        // Corrupt or unreadable storage: fall through to the sign-in screen.
      } finally {
        if (!cancelled) {
          setRestoring(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshBillingGate, refreshViewerName]);

  const commitSession = useCallback(
    async (
      credential: string,
      email: string,
      handOffFrom?: AuthCtaFrame | null,
      name?: string | null,
    ) => {
      await saveSession(credential, email);
      setAuthCookie(credential);
      setViewerEmail(email);
      if (name) {
        setViewerName(name);
      } else {
        void refreshViewerName(credential);
      }
      setSignInState("idle");
      await refreshBillingGate();
      if (handOffFrom) {
        setAuthHandOff({ from: handOffFrom });
      }
      setSignedIn(true);
    },
    [refreshBillingGate, refreshViewerName],
  );

  const requestToken = useCallback(
    async (
      path: "sign-in/email" | "sign-up/email",
      email: string,
      password: string,
      options?: { readonly requireToken?: boolean },
    ): Promise<AuthTokenResult> => {
      const timeout = AbortSignal.timeout(45_000);
      // Do not set Origin here: iOS URLSession strips/replaces it with "null".
      // Production stamps the canonical app origin in /api/auth before CSRF.
      const response = await fetch(`${AGENT_URL}/api/auth/${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ email, password, name: email.split("@")[0] }),
        signal: timeout,
      });
      const body = (await response.json().catch(() => null)) as {
        token?: string;
        user?: unknown;
        message?: string;
        error?: { message?: string } | string;
      } | null;
      // RN fetch cannot read Set-Cookie (iOS strips it from the header map),
      // so the credential comes from the response body via better-auth's
      // bearer plugin on the server.
      const credential = body?.token ?? null;

      if (!response.ok || (options?.requireToken !== false && !credential)) {
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

      return {
        credential,
        name: nameFromAuthUser(body?.user),
      };
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
        const result = await requestToken("sign-in/email", email, password);
        if (!result.credential) {
          throw new Error("Sign-in failed.");
        }
        await commitSession(
          result.credential,
          email,
          handOffFrom,
          result.name,
        );
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
        // Prefer a bearer token from sign-up; otherwise sign in immediately.
        const fromSignUp = await requestToken(
          "sign-up/email",
          email,
          password,
          { requireToken: false },
        );
        const result = fromSignUp.credential
          ? fromSignUp
          : await requestToken("sign-in/email", email, password);
        if (!result.credential) {
          throw new Error("Sign-up failed.");
        }
        await commitSession(
          result.credential,
          email,
          handOffFrom,
          result.name,
        );
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

  const checkEmailExists = useCallback(async (email: string) => {
    try {
      const timeout = AbortSignal.timeout(15_000);
      const response = await fetch(`${AGENT_URL}/api/auth/email-status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
        signal: timeout,
      });
      if (!response.ok) return null;
      const body = (await response.json().catch(() => null)) as {
        exists?: unknown;
      } | null;
      return typeof body?.exists === "boolean" ? body.exists : null;
    } catch {
      return null;
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    setSignInState("signing-in");
    setSignInError(null);
    try {
      const timeout = AbortSignal.timeout(45_000);
      const redirectTo = `${AGENT_URL.replace(/\/$/, "")}/reset-password`;
      const response = await fetch(
        `${AGENT_URL}/api/auth/request-password-reset`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, redirectTo }),
          signal: timeout,
        },
      );
      const body = (await response.json().catch(() => null)) as {
        message?: string;
        error?: { message?: string } | string;
      } | null;
      if (!response.ok) {
        const detail =
          (typeof body?.error === "string"
            ? body.error
            : body?.error?.message) ??
          body?.message ??
          `Reset failed (${response.status}).`;
        throw new Error(detail);
      }
      setSignInState("idle");
      return true;
    } catch (cause) {
      setSignInState("error");
      const message = cause instanceof Error ? cause.message : String(cause);
      setSignInError(
        message.toLowerCase().includes("abort")
          ? "Can't reach Pearl. Check your connection and try again."
          : message,
      );
      return false;
    }
  }, []);

  const resetPassword = useCallback(
    async (token: string, newPassword: string) => {
      setSignInState("signing-in");
      setSignInError(null);
      try {
        const timeout = AbortSignal.timeout(45_000);
        const response = await fetch(`${AGENT_URL}/api/auth/reset-password`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token, newPassword }),
          signal: timeout,
        });
        const body = (await response.json().catch(() => null)) as {
          message?: string;
          error?: { message?: string } | string;
        } | null;
        if (!response.ok) {
          const detail =
            (typeof body?.error === "string"
              ? body.error
              : body?.error?.message) ??
            body?.message ??
            `Reset failed (${response.status}).`;
          throw new Error(detail);
        }
        setSignInState("idle");
      } catch (cause) {
        setSignInState("error");
        const message = cause instanceof Error ? cause.message : String(cause);
        setSignInError(
          message.toLowerCase().includes("abort")
            ? "Can't reach Pearl. Check your connection and try again."
            : message,
        );
        throw cause;
      }
    },
    [],
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
    void clearAppIconBadge();
    setAuthCookie(null);
    void clearSession();
    setViewerEmail(null);
    setViewerName(null);
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
      viewerName,
      restoring,
      billingReady,
      authHandOff,
      signInState,
      signInError,
      signIn,
      signUp,
      requestPasswordReset,
      resetPassword,
      checkEmailExists,
      completeAuthHandOff,
      markBillingReady,
      setViewerName,
      signOut,
    }),
    [
      signedIn,
      viewerEmail,
      viewerName,
      restoring,
      billingReady,
      authHandOff,
      signInState,
      signInError,
      signIn,
      signUp,
      requestPasswordReset,
      resetPassword,
      checkEmailExists,
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
