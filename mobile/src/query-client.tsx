import { useEffect, useState, type ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider as TanStackQueryClientProvider,
  focusManager,
} from "@tanstack/react-query";
import { AppState, type AppStateStatus, Platform } from "react-native";

import { isTransportFailure } from "./http";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        retry: 1,
        refetchOnWindowFocus: true,
      },
    },
  });
}

function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== "web") {
    focusManager.setFocused(status === "active");
  }
}

/**
 * Per-account QueryClient. Remount via `accountKey` on sign-out / switch so
 * cached records from another user cannot leak.
 */
export function QueryProvider({
  accountKey,
  children,
}: {
  readonly accountKey: string;
  readonly children: ReactNode;
}) {
  const [client] = useState(() => createQueryClient());

  useEffect(() => {
    const subscription = AppState.addEventListener("change", onAppStateChange);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    client.clear();
  }, [accountKey, client]);

  return (
    <TanStackQueryClientProvider client={client} key={accountKey}>
      {children}
    </TanStackQueryClientProvider>
  );
}

/** Red load/retry banners — not when offline or transport failures. */
export function showQueryErrorBanner(
  offline: boolean,
  error: unknown,
): boolean {
  if (error == null) return false;
  if (offline || isTransportFailure(error)) return false;
  return true;
}

export function queryErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export const queryKeys = {
  goals: ["goals"] as const,
  notes: ["notes"] as const,
  note: (id: string) => ["notes", id] as const,
  tasks: ["tasks"] as const,
  library: ["library"] as const,
  projects: ["projects"] as const,
  project: (id: string) => ["projects", id] as const,
  financesMonth: (year: number, month: number) =>
    ["finances", year, month] as const,
  financesTransactions: (params: string) =>
    ["finances-transactions", params] as const,
};
