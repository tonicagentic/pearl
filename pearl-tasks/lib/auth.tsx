import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { PEARL_URL } from "./config";
import {
  clearSharedSessionToken,
  readSharedSessionToken,
  writeSharedSessionToken,
} from "./shared-session-keychain";

const TOKEN_KEY = "pearltasks_session_token";
const EMAIL_KEY = "pearltasks_session_email";
const NAME_KEY = "pearltasks_session_name";

type SessionUser = {
  id?: string;
  email: string;
  name: string | null;
};

type SessionState = {
  data: { user: SessionUser } | null;
  isPending: boolean;
};

type SessionContextValue = SessionState & {
  refetch: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

async function storeSession(token: string, user: SessionUser) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(EMAIL_KEY, user.email);
  if (user.name) {
    await SecureStore.setItemAsync(NAME_KEY, user.name);
  } else {
    await SecureStore.deleteItemAsync(NAME_KEY);
  }
  await writeSharedSessionToken(token);
}

async function clearStoredSession() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(EMAIL_KEY);
  await SecureStore.deleteItemAsync(NAME_KEY);
  await clearSharedSessionToken();
}

export async function getSessionToken(): Promise<string | null> {
  const local = await SecureStore.getItemAsync(TOKEN_KEY);
  if (local) return local;

  const shared = await readSharedSessionToken();
  if (!shared) return null;

  await SecureStore.setItemAsync(TOKEN_KEY, shared);
  return shared;
}

async function signInRequest(email: string, password: string) {
  let response: Response;
  try {
    response = await fetch(`${PEARL_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        password,
        name: email.trim().split("@")[0],
      }),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "network error";
    throw new Error(
      `Could not reach Pearl at ${PEARL_URL} (${reason}). Is Pearl running?`,
    );
  }

  const body = (await response.json().catch(() => null)) as {
    token?: string;
    user?: { id?: string; email?: string; name?: string };
    message?: string;
    error?: { message?: string } | string;
  } | null;

  const token = body?.token ?? null;
  if (!response.ok || !token) {
    const detail =
      (typeof body?.error === "string"
        ? body.error
        : body?.error?.message) ??
      body?.message ??
      `Sign-in failed (${response.status})`;
    throw new Error(detail);
  }

  const user: SessionUser = {
    id: body?.user?.id,
    email: body?.user?.email ?? email.trim(),
    name: body?.user?.name ?? null,
  };
  await storeSession(token, user);
  return user;
}

async function fetchSessionUser(token: string): Promise<SessionUser | null> {
  const response = await fetch(`${PEARL_URL}/api/auth/get-session`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) return null;
  const text = await response.text();
  if (!text || text === "null") return null;

  const body = JSON.parse(text) as {
    user?: { id?: string; email?: string; name?: string | null };
  } | null;
  if (!body?.user?.email) return null;

  return {
    id: body.user.id,
    email: body.user.email,
    name: body.user.name ?? null,
  };
}

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [state, setState] = useState<SessionState>({
    data: null,
    isPending: true,
  });

  const refetch = useCallback(async () => {
    const token = await getSessionToken();
    if (!token) {
      setState({ data: null, isPending: false });
      return;
    }

    try {
      const user = await fetchSessionUser(token);
      if (!user) {
        await clearStoredSession();
        setState({ data: null, isPending: false });
        return;
      }

      await storeSession(token, user);
      setState({ data: { user }, isPending: false });
    } catch {
      const email = await SecureStore.getItemAsync(EMAIL_KEY);
      const name = await SecureStore.getItemAsync(NAME_KEY);
      if (email) {
        setState({
          data: { user: { email, name } },
          isPending: false,
        });
        return;
      }
      setState({ data: null, isPending: false });
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const value = useMemo(
    () => ({ ...state, refetch }),
    [state, refetch],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within AuthProvider");
  }
  return ctx;
}

export const authClient = {
  async signInEmail(email: string, password: string) {
    return signInRequest(email, password);
  },
  async signOut() {
    const token = await getSessionToken();
    if (token) {
      try {
        await fetch(`${PEARL_URL}/api/auth/sign-out`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: "{}",
        });
      } catch {
        // Local clear still runs.
      }
    }
    await clearStoredSession();
  },
};
