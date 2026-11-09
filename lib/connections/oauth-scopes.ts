import type { ConnectionId } from "./catalog";

/**
 * OAuth scopes for user-scoped Connect grants that need an explicit list.
 * Bare URL-created connectors often omit usable defaults; Settings authorize,
 * status checks, and agent `connect()` all pass these via
 * {@link connectionTokenParams}.
 */

/** Xero Remote MCP — granular read scopes only (new apps reject broad ones). */
export const XERO_OAUTH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "accounting.settings.read",
  "accounting.contacts.read",
  "accounting.payments.read",
  "accounting.invoices.read",
  "accounting.banktransactions.read",
  "accounting.manualjournals.read",
  "accounting.reports.aged.read",
  "accounting.reports.balancesheet.read",
  "accounting.reports.profitandloss.read",
  "accounting.reports.trialbalance.read",
] as const;

/**
 * GitHub Copilot readonly MCP scopes from
 * https://api.githubcopilot.com/.well-known/oauth-protected-resource/mcp/readonly
 * (read-oriented subset).
 */
export const GITHUB_OAUTH_SCOPES = [
  "openid",
  "offline_access",
  "repo",
  "read:org",
  "read:user",
  "user:email",
] as const;

/**
 * Gmail MCP scopes. `gmail.compose` covers create_draft on the MCP server and
 * the REST `users.messages.send` call behind send_gmail_message. Grants made
 * before compose was added only carry `gmail.readonly`, so those users must
 * re-authorize once from Settings.
 */
export const GMAIL_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
] as const;

/** Google Sheets MCP (developer preview) — read and edit spreadsheets. */
export const SHEETS_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
] as const;

/** Extra Connect token params for a catalog connection (scopes, etc.). */
export function connectionTokenParams(id: ConnectionId): {
  readonly scopes?: string[];
} {
  if (id === "gmail") {
    return { scopes: [...GMAIL_OAUTH_SCOPES] };
  }
  if (id === "sheets") {
    return { scopes: [...SHEETS_OAUTH_SCOPES] };
  }
  if (id === "xero") {
    return { scopes: [...XERO_OAUTH_SCOPES] };
  }
  if (id === "github") {
    return { scopes: [...GITHUB_OAUTH_SCOPES] };
  }
  return {};
}
