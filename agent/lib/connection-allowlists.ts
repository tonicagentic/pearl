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
  sheets: ["get_spreadsheet", "get_values"],
  /**
   * Expo MCP reads (no logs — those live on CONNECTION_EXPO_DIAGNOSTIC_TOOLS).
   * https://docs.expo.dev/mcp/
   */
  expo: [
    "read_documentation",
    "search_documentation",
    "usage_budget_get",
    "workflow_info",
    "workflow_list",
    "build_list",
    "build_info",
    "sandbox_list",
    "sandbox_wait",
    "sandbox_artifact_get",
    "sandbox_artifact_list",
    "sandbox_read_file",
    "observe_versions",
    "observe_metrics_summary",
    "observe_metrics",
    "observe_routes",
    "observe_event_names",
    "observe_events",
    "observe_session",
    "simulator_get",
    "simulator_list",
    "automation_take_screenshot",
    "automation_find_view",
    "testflight_crashes",
    "testflight_feedback",
    "appstore_reviews",
    "playstore_crashes",
    "playstore_reviews",
    "expo_router_sitemap",
  ],
  /**
   * Neon MCP reads (no logs — those live on CONNECTION_NEON_DIAGNOSTIC_TOOLS).
   * https://neon.com/docs/ai/neon-mcp-server
   * run_sql is approval-gated even though Neon marks it readOnlySafe.
   */
  neon: [
    "list_organizations",
    "describe_table_schema",
    "get_database_tables",
    "describe_branch",
    "get_neon_auth_config",
    "explain_sql_statement",
    "list_slow_queries",
    "inspect_database",
    "search",
    "fetch",
    "search_docs",
    "get_doc",
    "list_incidents",
    "list_projects",
    "count_projects",
    "describe_project",
    "list_project_permissions",
    "list_project_members",
    "list_regions",
    "list_operations",
    "get_operation",
    "get_project_consumption",
    "get_branch_consumption",
    "list_branches",
    "get_branch",
    "get_default_branch",
    "compare_database_schema",
    "list_postgres_roles",
    "get_postgres_role",
    "list_postgres_databases",
    "get_postgres_database",
    "list_postgres_endpoints",
    "list_branch_computes",
    "get_postgres_endpoint",
    "list_snapshots",
    "get_snapshot_schedule",
    "get_auth",
    "list_auth_trusted_domains",
    "get_auth_oauth_server",
    "list_auth_oauth_clients",
    "get_auth_oauth_client",
    "get_data_api",
    "get_ai_gateway",
    "list_functions",
    "get_function",
    "list_functions_custom_domains",
    "list_triggers",
    "get_trigger",
    "list_credentials",
    "get_storage",
    "list_storage_buckets",
    "list_storage_objects",
    "get_realtime",
  ],
  /**
   * Better Stack MCP reads (help tools with "logs" in the name sit on
   * CONNECTION_BETTERSTACK_DIAGNOSTIC_TOOLS). https://mcp.betterstack.com
   */
  betterstack: [
    "application",
    "applications",
    "available_incident_escalation_policies",
    "chart",
    "chart_alert",
    "chart_alert_help",
    "chart_alerts",
    "chart_building_help",
    "clusters",
    "dashboard",
    "dashboard_query_help",
    "dashboard_templates",
    "dashboards",
    "data_regions",
    "documentation",
    "error",
    "errors",
    "errors_query_help",
    "escalation_policies",
    "escalation_policy",
    "export_dashboard",
    "heartbeat",
    "heartbeat_availability",
    "heartbeats",
    "incident",
    "incident_comments",
    "incident_timeline",
    "incidents",
    "metric",
    "metric_expressions",
    "metrics_query_help",
    "metrics_schema",
    "monitor",
    "monitor_availability",
    "monitor_response_times",
    "monitors",
    "on_call",
    "on_call_event",
    "on_call_events",
    "on_call_rotation",
    "on_calls",
    "query",
    "query_help",
    "releases",
    "render_chart",
    "replays_query_help",
    "severities",
    "severity",
    "source",
    "source_fields",
    "sources",
    "status_page",
    "status_page_report_update",
    "status_page_report_updates",
    "status_page_reports",
    "status_page_resources",
    "status_page_sections",
    "status_pages",
    "team_members",
    "team_roles",
    "teams",
  ],
} as const;

export type AllowlistedConnectionId = keyof typeof CONNECTION_READONLY_ALLOWLISTS;

/**
 * Write tools that a live connection exposes on top of its read-only
 * allowlist. Every name here sits behind a per-call approval policy
 * (`agent/lib/connection-approval.ts`) and is denied in plan mode. They are
 * deliberately kept out of `CONNECTION_READONLY_ALLOWLISTS` so the read-only
 * tests stay meaningful.
 */
export const CONNECTION_WRITE_TOOLS = {
  /**
   * Gmail MCP: drafts plus label changes (archive = remove INBOX, mark read =
   * remove UNREAD). Never sends — see send_gmail_message / apply_mail_batch.
   */
  gmail: [
    "create_draft",
    "label_message",
    "label_thread",
    "unlabel_message",
    "unlabel_thread",
  ],
  /** Google Sheets MCP (developer preview) exposes no create tool today. */
  sheets: [
    "insert_dimension",
    "update_formulas",
    "update_spreadsheet",
    "update_values",
  ],
  /**
   * Expo MCP writes / metered actions. Approval every call; denied in plan
   * mode. sandbox_exec / sandbox_write_stdin and public store reply tools are
   * omitted from the connection entirely.
   */
  expo: [
    "usage_budget_create",
    "workflow_run",
    "workflow_cancel",
    "workflow_validate",
    "build_run",
    "build_submit",
    "build_cancel",
    "sandbox_create",
    "sandbox_stop",
    "sandbox_artifact_create",
    "simulator_start",
    "simulator_stop",
    "automation_tap",
    "automation_type",
    "automation_scroll",
    "open_devtools",
  ],
  /**
   * Neon MCP writes / mutating SQL. Approval every call; denied in plan mode.
   * send_feedback is included because the write-heuristic treats `send_*` as a write.
   */
  neon: [
    "send_feedback",
    "run_sql",
    "run_sql_transaction",
    "prepare_database_migration",
    "complete_database_migration",
    "get_connection_string",
    "prepare_query_tuning",
    "complete_query_tuning",
    "create_project",
    "update_project",
    "delete_project",
    "recover_project",
    "create_branch",
    "update_branch",
    "delete_branch",
    "set_default_branch",
    "reset_from_parent",
    "finalize_branch_restore",
    "create_postgres_role",
    "delete_postgres_role",
    "reset_postgres_role_password",
    "create_postgres_database",
    "update_postgres_database",
    "delete_postgres_database",
    "create_postgres_endpoint",
    "update_postgres_endpoint",
    "delete_postgres_endpoint",
    "start_postgres_endpoint",
    "suspend_postgres_endpoint",
    "restart_postgres_endpoint",
    "set_snapshot_schedule",
    "create_snapshot",
    "update_snapshot",
    "delete_snapshot",
    "restore_snapshot",
    "provision_neon_auth",
    "disable_auth",
    "update_auth_config",
    "list_auth_oauth_providers",
    "add_auth_oauth_provider",
    "update_auth_oauth_provider",
    "delete_auth_oauth_provider",
    "add_auth_trusted_domain",
    "delete_auth_trusted_domain",
    "create_auth_user",
    "delete_auth_user",
    "update_auth_user_role",
    "update_auth_oauth_server",
    "create_auth_oauth_client",
    "update_auth_oauth_client",
    "delete_auth_oauth_client",
    "rotate_auth_oauth_client_secret",
    "update_auth_allow_localhost",
    "update_auth_email_and_password",
    "update_auth_email_provider",
    "send_auth_test_email",
    "update_auth_plugins_magic_link",
    "update_auth_plugins_organization",
    "update_auth_plugins_phone_number",
    "update_auth_webhooks",
    "update_auth_logs_export",
    "provision_neon_data_api",
    "update_data_api",
    "delete_data_api",
    "update_function",
    "delete_function",
    "deploy_function",
    "register_functions_custom_domain",
    "delete_functions_custom_domain",
    "create_trigger",
    "update_trigger",
    "delete_trigger",
    "create_credential",
    "revoke_credential",
    "rotate_credential",
    "create_storage_bucket",
    "delete_storage_bucket",
    "delete_storage_object",
    "delete_storage_objects_by_prefix",
    "presign_storage_object",
    "enable_realtime",
    "disable_realtime",
    "get_realtime_secret",
    "rotate_realtime_secret",
  ],
  /**
   * Better Stack MCP writes (incidents, monitors, dashboards, team changes).
   * Approval every call; denied in plan mode.
   */
  betterstack: [
    "acknowledge_incident",
    "add_chart_to_dashboard",
    "add_dashboard_section",
    "change_team_member_role",
    "create_application",
    "create_chart_alert",
    "create_cloud_connection",
    "create_dashboard",
    "create_heartbeat",
    "create_incident",
    "create_incident_comment",
    "create_metric_expression",
    "create_monitor",
    "create_source",
    "create_status_page_report",
    "create_status_page_report_update",
    "create_status_page_resource",
    "create_status_page_section",
    "delete_chart_alert",
    "delete_metric_expression",
    "edit_application",
    "edit_chart",
    "edit_chart_alert",
    "edit_dashboard",
    "edit_dashboard_section",
    "escalate_incident",
    "import_dashboard",
    "invite_team_member",
    "move_charts",
    "remove_chart",
    "remove_dashboard",
    "remove_dashboard_section",
    "remove_dashboard_variable",
    "remove_status_page_resource",
    "remove_status_page_section",
    "remove_team_member",
    "reopen_incident",
    "resolve_incident",
    "set_dashboard_variable",
    "toggle_chart_alert_pause",
    "update_error_state",
    "update_metric_expression",
    "update_status_page",
    "update_status_page_resource",
    "update_status_page_section",
  ],
} as const;

/** Expo log / diagnostic tools — discoverable, not in the readonly list. */
export const CONNECTION_EXPO_DIAGNOSTIC_TOOLS = [
  "build_logs",
  "workflow_logs",
  "collect_app_logs",
] as const;

/** Expo allowlist for the live connection: reads, diagnostics, and writes. */
export const CONNECTION_EXPO_ALLOWLIST = [
  ...CONNECTION_READONLY_ALLOWLISTS.expo,
  ...CONNECTION_EXPO_DIAGNOSTIC_TOOLS,
  ...CONNECTION_WRITE_TOOLS.expo,
] as const;

/** Neon log / diagnostic tools — discoverable, not in the readonly list. */
export const CONNECTION_NEON_DIAGNOSTIC_TOOLS = [
    "query_logs",
    "list_log_fields",
    "list_log_field_values",
    "query_loki_logs",
] as const;

/** Neon allowlist for the live connection: reads, diagnostics, and writes. */
export const CONNECTION_NEON_ALLOWLIST = [
  ...CONNECTION_READONLY_ALLOWLISTS.neon,
  ...CONNECTION_NEON_DIAGNOSTIC_TOOLS,
  ...CONNECTION_WRITE_TOOLS.neon,
] as const;

/** Better Stack help tools that look like logs — discoverable, not readonly. */
export const CONNECTION_BETTERSTACK_DIAGNOSTIC_TOOLS = [
    "explore_logs_query_help",
] as const;

/** Better Stack allowlist for the live connection. */
export const CONNECTION_BETTERSTACK_ALLOWLIST = [
  ...CONNECTION_READONLY_ALLOWLISTS.betterstack,
  ...CONNECTION_BETTERSTACK_DIAGNOSTIC_TOOLS,
  ...CONNECTION_WRITE_TOOLS.betterstack,
] as const;


/** Gmail allowlist for the live connection: reads plus approval-gated writes. */
export const CONNECTION_COMPOSE_ALLOWLISTS = {
  gmail: [
    ...CONNECTION_READONLY_ALLOWLISTS.gmail,
    ...CONNECTION_WRITE_TOOLS.gmail,
  ],
} as const;

/** Sheets allowlist for the live connection: reads plus approval-gated writes. */
export const CONNECTION_SHEETS_ALLOWLIST = [
  ...CONNECTION_READONLY_ALLOWLISTS.sheets,
  ...CONNECTION_WRITE_TOOLS.sheets,
] as const;

/**
 * Tempo (company CRM) MCP tools, named after the ops in tonic-crm's
 * `src/lib/agent/crm-ops.ts`. Reads run freely; writes need approval and are
 * denied in plan mode. Machine-only ops (`dispatch_due_tasks`,
 * `finish_agent_task`) are intentionally absent.
 */
export const TEMPO_READ_TOOLS = [
  "list_agent_tasks",
  "list_clarifications",
  "list_companies_for_offer",
  "list_company_offer_fits",
  "list_company_product_fits",
  "list_deal_proposals",
  "list_meetings",
  "list_outstanding_work",
  "list_thin_records",
  "read_company_history",
  "read_deal_history",
  "read_person_history",
  "resolve",
  "search",
] as const;

export const TEMPO_WRITE_TOOLS = [
  "answer_clarification",
  "attach_meeting_note",
  "create_clarification",
  "create_meeting",
  "create_reminder",
  "create_task",
  "enqueue_research",
  "import_prospects",
  "link_activity",
  "link_proposal",
  "record_fact",
  "replace_company_offer_fits",
  "replace_company_product_fits",
  "research_company",
  "schedule_recheck",
  "unlink_proposal",
  "upsert_company",
  "upsert_deal",
  "upsert_person",
  "write_brief",
] as const;

export const TEMPO_ALLOWLIST = [
  ...TEMPO_READ_TOOLS,
  ...TEMPO_WRITE_TOOLS,
] as const;

/** Alias kept for callers that follow the `CONNECTION_*` naming. */
export const CONNECTION_TEMPO_ALLOWLIST = TEMPO_ALLOWLIST;

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
