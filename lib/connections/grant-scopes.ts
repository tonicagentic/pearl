import type { ConnectionId } from "@/lib/connections/catalog";
import {
  connectionTokenParams,
  EXPO_OAUTH_SCOPES,
  GITHUB_OAUTH_SCOPES,
  GMAIL_OAUTH_SCOPES,
  SHEETS_OAUTH_SCOPES,
  XERO_OAUTH_SCOPES,
} from "@/lib/connections/oauth-scopes";

/** Scopes Pearl asks for, including empty for providers that use connector defaults. */
export function requestedScopesFor(id: ConnectionId): readonly string[] {
  const fromParams = connectionTokenParams(id).scopes;
  if (fromParams) return fromParams;
  return [];
}

export function missingFromGranted(
  requested: readonly string[],
  granted: readonly string[] | undefined,
): readonly string[] | undefined {
  if (!granted || requested.length === 0) return undefined;
  const have = new Set(granted.map(normalizeScope));
  const missing = requested
    .map(normalizeScope)
    .filter((scope) => scope.length > 0 && !have.has(scope));
  return [...new Set(missing)];
}

function normalizeScope(scope: string): string {
  return scope.trim().toLowerCase();
}

/** Exported for tests — known requested-scope catalogs. */
export const GRANT_SCOPE_CATALOGS = {
  github: GITHUB_OAUTH_SCOPES,
  gmail: GMAIL_OAUTH_SCOPES,
  sheets: SHEETS_OAUTH_SCOPES,
  xero: XERO_OAUTH_SCOPES,
  expo: EXPO_OAUTH_SCOPES,
} as const;
