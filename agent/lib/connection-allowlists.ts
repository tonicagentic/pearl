/** Read-only tool allowlists for user-scoped MCP connections. Keep these
 * aligned with `agent/connections/*.ts`. Tests assert they contain no write
 * or log tool names. */
export const CONNECTION_READONLY_ALLOWLISTS = {
  gmail: [
    "get_message",
    "get_thread",
    "list_drafts",
    "list_labels",
    "search_threads",
  ],
  calendar: [
    "get_event",
    "list_calendars",
    "list_events",
    "search_events",
    "suggest_time",
  ],
  drive: [
    "download_file_content",
    "get_file_metadata",
    "get_file_permissions",
    "list_recent_files",
    "read_file_content",
    "search_files",
  ],
  github: [
    "search_repositories",
    "get_file_contents",
    "issue_read",
    "pull_request_read",
  ],
  vercel: [
    "list_teams",
    "list_projects",
    "get_project",
    "list_deployments",
    "get_deployment",
    "search_documentation",
  ],
} as const;

export type AllowlistedConnectionId = keyof typeof CONNECTION_READONLY_ALLOWLISTS;

/**
 * Xero Remote MCP tool names vary from the self-hosted OSS list (and include
 * org-selection tools we do not hardcode). Prefer blocking known writes so
 * every read/report tool stays discoverable.
 */
export const CONNECTION_WRITE_BLOCKLISTS = {
  xero: [
    "create-bank-transaction",
    "create-contact",
    "create-credit-note",
    "create-invoice",
    "create-item",
    "create-manual-journal",
    "create-payment",
    "create-payroll-timesheet",
    "create-quote",
    "create-tracking-category",
    "create-tracking-option",
    "delete-payroll-timesheet",
    "update-bank-transaction",
    "update-contact",
    "update-credit-note",
    "update-invoice",
    "update-item",
    "update-manual-journal",
    "update-payroll-timesheet-line",
    "update-quote",
    "update-tracking-category",
    "update-tracking-options",
    // Underscore variants if the hosted server renames tools.
    "create_bank_transaction",
    "create_contact",
    "create_credit_note",
    "create_invoice",
    "create_item",
    "create_manual_journal",
    "create_payment",
    "create_payroll_timesheet",
    "create_quote",
    "create_tracking_category",
    "create_tracking_option",
    "delete_payroll_timesheet",
    "update_bank_transaction",
    "update_contact",
    "update_credit_note",
    "update_invoice",
    "update_item",
    "update_manual_journal",
    "update_payroll_timesheet_line",
    "update_quote",
    "update_tracking_category",
    "update_tracking_options",
  ],
} as const;

export type BlocklistedConnectionId = keyof typeof CONNECTION_WRITE_BLOCKLISTS;

const WRITE_PREFIXES = [
  "create_",
  "create-",
  "update_",
  "update-",
  "delete_",
  "delete-",
  "send_",
  "send-",
  "deploy_",
  "deploy-",
  "buy_",
  "buy-",
  "write_",
  "write-",
  "edit_",
  "edit-",
  "reply_",
  "reply-",
  "add_",
  "add-",
  "change_",
  "change-",
  "label_",
  "label-",
  "unlabel_",
  "unlabel-",
  "copy_",
  "copy-",
  "insert_",
  "insert-",
  "respond_",
  "respond-",
] as const;

/** True when a tool name looks like a write or log surface. */
export function looksLikeWriteOrLogTool(name: string): boolean {
  if (
    name.includes("_log") ||
    name.includes("logs") ||
    name.includes("runtime_error") ||
    name.endsWith("_log") ||
    name.endsWith("_logs") ||
    name.endsWith("-log") ||
    name.endsWith("-logs")
  ) {
    return true;
  }
  return WRITE_PREFIXES.some((prefix) => name.startsWith(prefix));
}
