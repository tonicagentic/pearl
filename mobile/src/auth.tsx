import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { AGENT_URL, setAuthCookie } from "./eve-transport";
import {
  clearSession,
  loadSession,
  onSessionInvalid,
  saveSession,
} from "./session-store";

export type SignInState = "idle" | "signing-in" | "error";

type AuthContextValue = {
  readonly signedIn: boolean;
  /** Email of the signed-in account, or a dev marker when the gate is skipped. */
  readonly viewerEmail: string | null;
  /** True while the Keychain session is being restored on cold start. */
  readonly restoring: boolean;
  readonly signInState: SignInState;
  readonly signInError: string | null;
  readonly signIn: (email: string, password: string) => Promise<void>;
  readonly skipSignIn: () => void;
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
  // EXPO_PUBLIC_SKIP_SIGN_IN=1 bypasses the gate for local dev testing.
  // Note: the skip path carries no session cookie, so surfaces that require a
  // real session (the issues REST routes) report it instead of pretending.
  const skip = process.env.EXPO_PUBLIC_SKIP_SIGN_IN === "1";
  const [signedIn, setSignedIn] = useState(skip);
  const [viewerEmail, setViewerEmail] = useState<string | null>(
    skip ? "local dev (no session)" : null,
  );
  const [restoring, setRestoring] = useState(!skip);
  const [signInState, setSignInState] = useState<SignInState>("idle");
  const [signInError, setSignInError] = useState<string | null>(null);

  // Cold-start restore: pick the stored session back up before rendering the
  // gate, so a signed-in user lands straight in the chat.
  useEffect(() => {
    if (skip) {
      return;
    }

    let cancelled = false;

    void loadSession()
      .then((session) => {
        if (cancelled || !session) {
          return;
        }

        setAuthCookie(session.cookie);
        setViewerEmail(session.email || null);
        setSignedIn(true);
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
  }, [skip]);

  // Server-side expiry: a stored cookie that gets rejected clears the state
  // and the Keychain copy. Ref-held so API clients can call sessionInvalid()
  // without re-subscribing churn.
  const signOutRef = useRef<() => void>(() => {});
  useEffect(() => {
    return onSessionInvalid(() => signOutRef.current());
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setSignInState("signing-in");
    setSignInError(null);

    try {
      // First-request agent compile can take 1-2 minutes on a cold dev
      // server; time out loudly instead of spinning forever.
      const timeout = AbortSignal.timeout(45_000);
      const response = await fetch(`${AGENT_URL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
        signal: timeout,
      });
      const body = (await response.json().catch(() => null)) as {
        token?: string;
      } | null;
      // RN fetch cannot read Set-Cookie (iOS strips it from the header map),
      // so the credential comes from the response body via better-auth's
      // bearer plugin on the server.
      const credential = body?.token;

      if (!response.ok || !credential) {
        const raw = await response.text().catch(() => "");
        throw new Error(
          `Sign-in failed (${response.status}) ${body ? JSON.stringify(body).slice(0, 160) : ""}`,
        );
      }

      setAuthCookie(credential);
      await saveSession(credential, email);
      setViewerEmail(email);
      setSignedIn(true);
    } catch (cause) {
      setSignInState("error");
      const message = cause instanceof Error ? cause.message : String(cause);
      setSignInError(
        message.includes("abort")
          ? `Can't reach ${AGENT_URL} — is the dev server up? (first request compiles the agent, ~1-2 min)`
          : message,
      );
    }
  }, []);

  // Local dev servers run eve's localDev() authenticator, which accepts
  // requests anonymously — no sign-in needed against localhost.
  const skipSignIn = useCallback(() => {
    setAuthCookie("");
    setViewerEmail("local dev (no session)");
    setSignedIn(true);
  }, []);

  const signOut = useCallback(() => {
    setAuthCookie(null);
    void clearSession();
    setViewerEmail(null);
    setSignedIn(false);
  }, []);
  signOutRef.current = signOut;

  const value = useMemo(
    () => ({
      signedIn,
      viewerEmail,
      restoring,
      signInState,
      signInError,
      signIn,
      skipSignIn,
      signOut,
    }),
    [
      signedIn,
      viewerEmail,
      restoring,
      signInState,
      signInError,
      signIn,
      skipSignIn,
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
