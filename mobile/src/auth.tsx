import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  /** Email of the signed-in account. */
  readonly viewerEmail: string | null;
  /** True while the Keychain session is being restored on cold start. */
  readonly restoring: boolean;
  readonly signInState: SignInState;
  readonly signInError: string | null;
  readonly signIn: (email: string, password: string) => Promise<void>;
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
  const [signInState, setSignInState] = useState<SignInState>("idle");
  const [signInError, setSignInError] = useState<string | null>(null);

  // Cold-start restore: pick the stored session back up before rendering the
  // gate, so a signed-in user lands straight in the chat.
  useEffect(() => {
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
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setSignInState("signing-in");
    setSignInError(null);

    try {
      // Bound network waits so sign-in does not spin indefinitely when offline.
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
        throw new Error(
          `Sign-in failed (${response.status}) ${body ? JSON.stringify(body).slice(0, 160) : ""}`,
        );
      }

      await saveSession(credential, email);
      setAuthCookie(credential);
      setViewerEmail(email);
      setSignInState("idle");
      setSignedIn(true);
    } catch (cause) {
      setSignInState("error");
      const message = cause instanceof Error ? cause.message : String(cause);
      setSignInError(
        message.toLowerCase().includes("abort")
          ? "Can't reach Pearl. Check your connection and try again."
          : message,
      );
    }
  }, []);

  const signOut = useCallback(() => {
    setAuthCookie(null);
    void clearSession();
    setViewerEmail(null);
    setSignInState("idle");
    setSignInError(null);
    setSignedIn(false);
  }, []);
  // Keep the invalidation listener in sync without writing to a ref in render.
  useEffect(() => onSessionInvalid(signOut), [signOut]);

  const value = useMemo(
    () => ({
      signedIn,
      viewerEmail,
      restoring,
      signInState,
      signInError,
      signIn,
      signOut,
    }),
    [
      signedIn,
      viewerEmail,
      restoring,
      signInState,
      signInError,
      signIn,
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
