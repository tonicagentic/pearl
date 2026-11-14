import type { ReactElement, ReactNode } from "react";
import { Redirect } from "expo-router";

import { useAuth } from "@/src/auth";

/**
 * Thin route guard: wait for session restore, then redirect or render.
 * Use from Expo Router pages that require a signed-in account.
 */
export function RequireSignedIn({
  children,
}: {
  readonly children: ReactNode;
}): ReactElement | null {
  const { signedIn, restoring } = useAuth();
  if (restoring) return null;
  if (!signedIn) return <Redirect href="/" />;
  return <>{children}</>;
}
