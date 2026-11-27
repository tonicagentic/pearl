import assert from "node:assert/strict";
import test from "node:test";
import {
  CONNECTION_BETTERSTACK_ALLOWLIST,
  CONNECTION_BETTERSTACK_DIAGNOSTIC_TOOLS,
  CONNECTION_COMPOSE_ALLOWLISTS,
  CONNECTION_EXPO_ALLOWLIST,
  CONNECTION_EXPO_DIAGNOSTIC_TOOLS,
  CONNECTION_NEON_ALLOWLIST,
  CONNECTION_NEON_DIAGNOSTIC_TOOLS,
  CONNECTION_READONLY_ALLOWLISTS,
  CONNECTION_SHEETS_ALLOWLIST,
  CONNECTION_TEMPO_ALLOWLIST,
  CONNECTION_VERCEL_ALLOWLIST,
  CONNECTION_VERCEL_BLOCKLIST,
  CONNECTION_VERCEL_DIAGNOSTIC_TOOLS,
  CONNECTION_WRITE_BLOCKLISTS,
  CONNECTION_WRITE_TOOLS,
  TEMPO_ALLOWLIST,
  TEMPO_READ_TOOLS,
  TEMPO_WRITE_TOOLS,
  VERCEL_CODER_WRITE_TOOLS_FULL,
  looksLikeWriteOrLogTool,
} from "../agent/lib/connection-allowlists.ts";
import {
  bareConnectionToolName,
  writeToolApproval,
} from "../agent/lib/connection-approval.ts";
import {
  CONNECTION_IDS,
  connectionConfiguration,
  connectionSubjectForUser,
  isConnectionId,
} from "../lib/connections/catalog.ts";
import {
  BETTERSTACK_OAUTH_SCOPES,
  EXPO_OAUTH_SCOPES,
  GITHUB_OAUTH_SCOPES,
  GMAIL_OAUTH_SCOPES,
  NEON_OAUTH_SCOPES,
  SHEETS_OAUTH_SCOPES,
  XERO_OAUTH_SCOPES,
  connectionTokenParams,
} from "../lib/connections/oauth-scopes.ts";

test("only fixed provider ids are accepted", () => {
  assert.deepEqual(CONNECTION_IDS, [
    "gmail",
    "calendar",
    "drive",
    "github",
    "vercel",
    "expo",
    "neon",
    "betterstack",
    "xero",
    "tempo",
    "sheets",
  ]);
  assert.equal(isConnectionId("github"), true);
  assert.equal(isConnectionId("gmail"), true);
  assert.equal(isConnectionId("expo"), true);
  assert.equal(isConnectionId("neon"), true);
  assert.equal(isConnectionId("betterstack"), true);
  assert.equal(isConnectionId("xero"), true);
  assert.equal(isConnectionId("notion"), false);
  assert.equal(isConnectionId("other"), false);
  assert.equal(isConnectionId({ id: "github" }), false);
});

test("durable Connect grant subject matches eve's Better Auth principal", () => {
  assert.deepEqual(connectionSubjectForUser("user-one"), {
    type: "user",
    id: "user-one",
    issuer: "better-auth",
  });
  assert.notDeepEqual(
    connectionSubjectForUser("user-two"),
    connectionSubjectForUser("user-one"),
  );
});

test("opt-in Google, GitHub, Vercel, and Xero need connector env vars", () => {
  assert.equal(connectionConfiguration("gmail", {}).connector, null);
  assert.equal(
    connectionConfiguration("gmail", { GMAIL_CONNECTOR: "gmail/test" })
      .connector,
    "gmail/test",
  );
  assert.equal(connectionConfiguration("calendar", {}).connector, null);
  assert.equal(
    connectionConfiguration("calendar", {
      CALENDAR_CONNECTOR: "calendar/test",
    }).connector,
    "calendar/test",
  );
  assert.equal(connectionConfiguration("drive", {}).connector, null);
  assert.equal(
    connectionConfiguration("drive", { DRIVE_CONNECTOR: "drive/test" })
      .connector,
    "drive/test",
  );
  assert.equal(connectionConfiguration("github", {}).connector, null);
  assert.equal(
    connectionConfiguration("github", { GITHUB_CONNECTOR: "github/test" })
      .connector,
    "github/test",
  );
  assert.equal(connectionConfiguration("vercel", {}).connector, null);
  assert.equal(
    connectionConfiguration("vercel", { VERCEL_CONNECTOR: "vercel/test" })
      .connector,
    "vercel/test",
  );
  assert.equal(connectionConfiguration("expo", {}).connector, null);
  assert.equal(
    connectionConfiguration("expo", { EXPO_CONNECTOR: "expo/pearl-expo" })
      .connector,
    "expo/pearl-expo",
  );
  assert.equal(connectionConfiguration("neon", {}).connector, null);
  assert.equal(
    connectionConfiguration("neon", { NEON_CONNECTOR: "mcp.neon.tech/pearl-neon" })
      .connector,
    "mcp.neon.tech/pearl-neon",
  );
  assert.equal(connectionConfiguration("betterstack", {}).connector, null);
  assert.equal(
    connectionConfiguration("betterstack", {
      BETTERSTACK_CONNECTOR: "mcp.betterstack.com/pearl-betterstack",
    }).connector,
    "mcp.betterstack.com/pearl-betterstack",
  );
  assert.equal(connectionConfiguration("xero", {}).connector, null);
  assert.equal(
    connectionConfiguration("xero", { XERO_CONNECTOR: "xero/pearl-xero" })
      .connector,
    "xero/pearl-xero",
  );
  assert.equal(connectionConfiguration("tempo", {}).connector, null);
  assert.equal(
    connectionConfiguration("tempo", { TEMPO_CONNECTOR: "tempo/crm" })
      .connector,
    "tempo/crm",
  );
  assert.equal(connectionConfiguration("sheets", {}).connector, null);
  assert.equal(
    connectionConfiguration("sheets", { SHEETS_CONNECTOR: "sheets/test" })
      .connector,
    "sheets/test",
  );
});

test("read-only allowlists exclude write and log tools", () => {
  for (const [id, tools] of Object.entries(CONNECTION_READONLY_ALLOWLISTS)) {
    assert.ok(tools.length > 0, id);
    for (const name of tools) {
      assert.equal(
        looksLikeWriteOrLogTool(name),
        false,
        `${id} allowlist includes write/log tool ${name}`,
      );
    }
  }
  assert.equal(looksLikeWriteOrLogTool("create_draft"), true);
  assert.equal(looksLikeWriteOrLogTool("create-invoice"), true);
  assert.equal(looksLikeWriteOrLogTool("get_runtime_logs"), true);
  assert.equal(looksLikeWriteOrLogTool("deploy_to_vercel"), true);
  assert.equal(looksLikeWriteOrLogTool("buy_domain"), true);
  assert.equal(looksLikeWriteOrLogTool("list_deployments"), false);
  assert.equal(looksLikeWriteOrLogTool("list-profit-and-loss"), false);
});

test("read-only Gmail allowlist stays free of create_draft; compose list adds writes", () => {
  assert.equal(
    CONNECTION_READONLY_ALLOWLISTS.gmail.includes("create_draft"),
    false,
  );
  assert.deepEqual(
    CONNECTION_COMPOSE_ALLOWLISTS.gmail.filter(
      (name) => !CONNECTION_READONLY_ALLOWLISTS.gmail.includes(name),
    ),
    [...CONNECTION_WRITE_TOOLS.gmail],
  );
  assert.equal(CONNECTION_WRITE_TOOLS.gmail.includes("send_message"), false);
});

test("Sheets and Tempo write tools are the ones that need approval", () => {
  for (const name of CONNECTION_WRITE_TOOLS.sheets) {
    assert.ok(CONNECTION_SHEETS_ALLOWLIST.includes(name), name);
  }
  for (const name of CONNECTION_READONLY_ALLOWLISTS.sheets) {
    assert.equal(CONNECTION_WRITE_TOOLS.sheets.includes(name), false, name);
  }
  assert.ok(TEMPO_ALLOWLIST.includes("search"));
  assert.ok(TEMPO_ALLOWLIST.includes("upsert_company"));
  assert.equal(TEMPO_ALLOWLIST.includes("dispatch_due_tasks"), false);
  assert.equal(TEMPO_ALLOWLIST.includes("finish_agent_task"), false);
  assert.deepEqual(CONNECTION_TEMPO_ALLOWLIST, TEMPO_ALLOWLIST);
  // Every non-read Tempo tool must be classed as a write, and vice versa.
  for (const name of TEMPO_READ_TOOLS) {
    assert.equal(TEMPO_WRITE_TOOLS.includes(name), false, name);
  }
  for (const name of TEMPO_ALLOWLIST) {
    const isRead = TEMPO_READ_TOOLS.includes(name);
    const looksWrite =
      looksLikeWriteOrLogTool(name) ||
      /^(upsert|import|link|unlink|attach|answer|enqueue|record|replace|research|schedule|write)_/.test(
        name,
      );
    assert.equal(isRead, !looksWrite, `${name} is misclassified`);
  }
});

test("Expo allowlist splits reads, diagnostics, and approval-gated writes", () => {
  for (const name of CONNECTION_READONLY_ALLOWLISTS.expo) {
    assert.equal(
      looksLikeWriteOrLogTool(name),
      false,
      `expo readonly includes write/log tool ${name}`,
    );
    assert.equal(CONNECTION_WRITE_TOOLS.expo.includes(name), false, name);
  }
  for (const name of CONNECTION_EXPO_DIAGNOSTIC_TOOLS) {
    assert.ok(looksLikeWriteOrLogTool(name), name);
    assert.ok(CONNECTION_EXPO_ALLOWLIST.includes(name), name);
    assert.equal(
      CONNECTION_READONLY_ALLOWLISTS.expo.includes(name),
      false,
      name,
    );
  }
  for (const name of CONNECTION_WRITE_TOOLS.expo) {
    assert.ok(CONNECTION_EXPO_ALLOWLIST.includes(name), name);
    assert.equal(
      CONNECTION_READONLY_ALLOWLISTS.expo.includes(name),
      false,
      name,
    );
  }
  assert.ok(CONNECTION_WRITE_TOOLS.expo.includes("simulator_start"));
  assert.ok(CONNECTION_WRITE_TOOLS.expo.includes("build_run"));
  assert.equal(CONNECTION_EXPO_ALLOWLIST.includes("sandbox_exec"), false);
  assert.equal(
    CONNECTION_EXPO_ALLOWLIST.includes("appstore_reply_review"),
    false,
  );
  assert.deepEqual(connectionTokenParams("expo").scopes, [...EXPO_OAUTH_SCOPES]);
  assert.deepEqual(EXPO_OAUTH_SCOPES, ["mcp:access"]);
});

test("Neon allowlist splits reads, diagnostics, and approval-gated writes", () => {
  for (const name of CONNECTION_READONLY_ALLOWLISTS.neon) {
    assert.equal(
      looksLikeWriteOrLogTool(name),
      false,
      `neon readonly includes write/log tool ${name}`,
    );
    assert.equal(CONNECTION_WRITE_TOOLS.neon.includes(name), false, name);
  }
  for (const name of CONNECTION_NEON_DIAGNOSTIC_TOOLS) {
    assert.ok(looksLikeWriteOrLogTool(name), name);
    assert.ok(CONNECTION_NEON_ALLOWLIST.includes(name), name);
  }
  assert.ok(CONNECTION_WRITE_TOOLS.neon.includes("run_sql"));
  assert.ok(CONNECTION_WRITE_TOOLS.neon.includes("create_project"));
  assert.equal(
    CONNECTION_READONLY_ALLOWLISTS.neon.includes("run_sql"),
    false,
  );
  assert.deepEqual(connectionTokenParams("neon").scopes, [...NEON_OAUTH_SCOPES]);
});

test("Better Stack allowlist splits reads, diagnostics, and approval-gated writes", () => {
  for (const name of CONNECTION_READONLY_ALLOWLISTS.betterstack) {
    assert.equal(
      looksLikeWriteOrLogTool(name),
      false,
      `betterstack readonly includes write/log tool ${name}`,
    );
    assert.equal(CONNECTION_WRITE_TOOLS.betterstack.includes(name), false, name);
  }
  for (const name of CONNECTION_BETTERSTACK_DIAGNOSTIC_TOOLS) {
    assert.ok(looksLikeWriteOrLogTool(name), name);
    assert.ok(CONNECTION_BETTERSTACK_ALLOWLIST.includes(name), name);
  }
  assert.ok(CONNECTION_WRITE_TOOLS.betterstack.includes("create_incident"));
  assert.ok(CONNECTION_WRITE_TOOLS.betterstack.includes("acknowledge_incident"));
  assert.ok(CONNECTION_READONLY_ALLOWLISTS.betterstack.includes("monitors"));
  assert.deepEqual(connectionTokenParams("betterstack").scopes, [
    ...BETTERSTACK_OAUTH_SCOPES,
  ]);
});

test("Vercel allowlist splits parent reads, coder diagnostics, and approval-gated writes", () => {
  for (const name of CONNECTION_READONLY_ALLOWLISTS.vercel) {
    assert.equal(
      looksLikeWriteOrLogTool(name),
      false,
      `vercel readonly includes write/log tool ${name}`,
    );
    assert.equal(CONNECTION_WRITE_TOOLS.vercel.includes(name), false, name);
  }
  assert.ok(
    CONNECTION_READONLY_ALLOWLISTS.vercel.includes("search_vercel_documentation"),
  );
  assert.equal(
    CONNECTION_READONLY_ALLOWLISTS.vercel.includes("search_documentation"),
    false,
  );
  for (const name of CONNECTION_VERCEL_DIAGNOSTIC_TOOLS) {
    assert.ok(CONNECTION_VERCEL_ALLOWLIST.includes(name), name);
    assert.equal(
      CONNECTION_READONLY_ALLOWLISTS.vercel.includes(name),
      false,
      name,
    );
  }
  assert.ok(looksLikeWriteOrLogTool("get_runtime_logs"));
  assert.ok(looksLikeWriteOrLogTool("get_runtime_errors"));
  // Build/event helpers stay on the coder diagnostic list even when the
  // name does not match the generic log heuristic.
  assert.ok(
    CONNECTION_VERCEL_DIAGNOSTIC_TOOLS.includes("list_deployment_events"),
  );
  for (const name of CONNECTION_WRITE_TOOLS.vercel) {
    assert.ok(CONNECTION_VERCEL_ALLOWLIST.includes(name), name);
    assert.equal(
      CONNECTION_READONLY_ALLOWLISTS.vercel.includes(name),
      false,
      name,
    );
  }
  assert.ok(CONNECTION_WRITE_TOOLS.vercel.includes("create_deployment"));
  assert.ok(CONNECTION_WRITE_TOOLS.vercel.includes("create_project_env"));
  assert.ok(CONNECTION_WRITE_TOOLS.vercel.includes("edit_project_env"));
  assert.equal(
    CONNECTION_WRITE_TOOLS.vercel.includes("pause_project"),
    false,
    "pause_project stays off ship-core (see VERCEL_CODER_WRITE_TOOLS_FULL)",
  );
  assert.ok(
    VERCEL_CODER_WRITE_TOOLS_FULL.includes("pause_project"),
    "full archive still lists pause_project for restore",
  );
  assert.ok(CONNECTION_VERCEL_ALLOWLIST.includes("get_runtime_logs"));
  assert.ok(CONNECTION_VERCEL_ALLOWLIST.includes("filter_project_envs"));
  assert.equal(
    CONNECTION_VERCEL_ALLOWLIST.includes("list_ai_gateway_models"),
    false,
    "AI gateway admin stays off ship-core",
  );
  for (const name of ["authorize_team_access", "authorize_team_sso"]) {
    assert.ok(
      CONNECTION_READONLY_ALLOWLISTS.vercel.includes(name),
      `${name} stays on parent readonly (consent link; browser is the approval)`,
    );
    assert.ok(CONNECTION_VERCEL_ALLOWLIST.includes(name), name);
    assert.equal(
      CONNECTION_WRITE_TOOLS.vercel.includes(name),
      false,
      `${name} is not write-gated`,
    );
    assert.equal(
      CONNECTION_VERCEL_BLOCKLIST.includes(name),
      false,
      `${name} is not blocked`,
    );
    assert.equal(looksLikeWriteOrLogTool(name), false, name);
  }
  for (const name of CONNECTION_VERCEL_BLOCKLIST) {
    assert.equal(CONNECTION_VERCEL_ALLOWLIST.includes(name), false, name);
    assert.equal(CONNECTION_WRITE_TOOLS.vercel.includes(name), false, name);
    assert.equal(
      CONNECTION_READONLY_ALLOWLISTS.vercel.includes(name),
      false,
      name,
    );
  }
  assert.ok(CONNECTION_VERCEL_BLOCKLIST.includes("buy_domain"));
  assert.ok(CONNECTION_VERCEL_BLOCKLIST.includes("create_ai_gateway_api_key"));
  assert.ok(
    CONNECTION_VERCEL_BLOCKLIST.includes("accept_project_transfer_request"),
  );
});

test("write approval asks for writes, denies in plan mode, passes reads", () => {
  const ctx = (toolName) => ({ toolName });
  const agentMode = writeToolApproval(TEMPO_WRITE_TOOLS, {
    planMode: () => false,
  });
  assert.equal(typeof agentMode, "object");
  assert.equal(typeof agentMode.request, "function");
  assert.equal(typeof agentMode.prompt, "function");
  assert.equal(agentMode.request(ctx("tempo__upsert_company")), "user-approval");
  assert.equal(agentMode.request(ctx("create_task")), "user-approval");
  assert.equal(agentMode.request(ctx("tempo__search")), "not-applicable");
  assert.equal(agentMode.request(ctx("tempo__list_meetings")), "not-applicable");
  assert.match(
    agentMode.prompt({
      toolName: "tempo__upsert_company",
      input: { name: "Acme" },
      callId: "call_1",
    }),
    /Approve Upsert company/i,
  );

  const planMode = writeToolApproval(TEMPO_WRITE_TOOLS, {
    planMode: () => true,
  });
  assert.equal(planMode.request(ctx("tempo__upsert_company")).type, "denied");
  assert.equal(planMode.request(ctx("tempo__search")), "not-applicable");
  assert.equal(bareConnectionToolName("gmail__create_draft"), "create_draft");
});

test("Gmail and Sheets token params request granular Google scopes", () => {
  assert.ok(GMAIL_OAUTH_SCOPES.includes("https://www.googleapis.com/auth/gmail.readonly"));
  assert.ok(GMAIL_OAUTH_SCOPES.includes("https://www.googleapis.com/auth/gmail.compose"));
  assert.equal(
    GMAIL_OAUTH_SCOPES.some((scope) => scope.endsWith("/mail.google.com/")),
    false,
  );
  assert.deepEqual(connectionTokenParams("gmail").scopes, [...GMAIL_OAUTH_SCOPES]);
  assert.deepEqual(connectionTokenParams("sheets").scopes, [...SHEETS_OAUTH_SCOPES]);
  assert.deepEqual(connectionTokenParams("tempo"), {});
});

test("Xero write blocklist only contains write tools", () => {
  const tools = CONNECTION_WRITE_BLOCKLISTS.xero;
  assert.ok(tools.length > 0);
  for (const name of tools) {
    assert.equal(
      looksLikeWriteOrLogTool(name),
      true,
      `xero blocklist includes non-write tool ${name}`,
    );
  }
});

test("Xero OAuth scopes stay granular and read-oriented", () => {
  assert.ok(XERO_OAUTH_SCOPES.includes("openid"));
  assert.ok(XERO_OAUTH_SCOPES.includes("offline_access"));
  assert.ok(XERO_OAUTH_SCOPES.includes("accounting.reports.profitandloss.read"));
  assert.ok(XERO_OAUTH_SCOPES.includes("accounting.banktransactions.read"));
  for (const scope of XERO_OAUTH_SCOPES) {
    assert.notEqual(scope, "accounting.transactions");
    assert.notEqual(scope, "accounting.transactions.read");
    assert.notEqual(scope, "accounting.reports.read");
    assert.equal(
      scope.startsWith("payroll."),
      false,
      `unexpected payroll scope ${scope}`,
    );
  }
});

test("GitHub OAuth scopes stay read-oriented for Copilot MCP", () => {
  assert.ok(GITHUB_OAUTH_SCOPES.includes("openid"));
  assert.ok(GITHUB_OAUTH_SCOPES.includes("offline_access"));
  assert.ok(GITHUB_OAUTH_SCOPES.includes("repo"));
  assert.ok(GITHUB_OAUTH_SCOPES.includes("read:user"));
  assert.equal(GITHUB_OAUTH_SCOPES.includes("write:packages"), false);
});

