import assert from "node:assert/strict";
import test from "node:test";
import {
  CONNECTION_COMPOSE_ALLOWLISTS,
  CONNECTION_READONLY_ALLOWLISTS,
  CONNECTION_SHEETS_ALLOWLIST,
  CONNECTION_TEMPO_ALLOWLIST,
  CONNECTION_WRITE_BLOCKLISTS,
  CONNECTION_WRITE_TOOLS,
  TEMPO_ALLOWLIST,
  TEMPO_READ_TOOLS,
  TEMPO_WRITE_TOOLS,
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
  GITHUB_OAUTH_SCOPES,
  GMAIL_OAUTH_SCOPES,
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
    "xero",
    "tempo",
    "sheets",
    "notion",
    "linear",
    "sentry",
  ]);
  assert.equal(isConnectionId("github"), true);
  assert.equal(isConnectionId("gmail"), true);
  assert.equal(isConnectionId("xero"), true);
  assert.equal(isConnectionId("notion"), true);
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

test("existing eve connections use their current connector names", () => {
  assert.equal(connectionConfiguration("notion", {}).connector, "notion");
  assert.equal(
    connectionConfiguration("linear", { LINEAR_CONNECTOR: "linear/team" })
      .connector,
    "linear/team",
  );
  assert.equal(connectionConfiguration("sentry", {}).label, "Sentry");
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

test("read-only Gmail allowlist stays free of create_draft; compose list adds only it", () => {
  assert.equal(
    CONNECTION_READONLY_ALLOWLISTS.gmail.includes("create_draft"),
    false,
  );
  assert.deepEqual(
    CONNECTION_COMPOSE_ALLOWLISTS.gmail.filter(
      (name) => !CONNECTION_READONLY_ALLOWLISTS.gmail.includes(name),
    ),
    ["create_draft"],
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

test("write approval asks for writes, denies in plan mode, passes reads", () => {
  const ctx = (toolName) => ({ toolName });
  const agentMode = writeToolApproval(TEMPO_WRITE_TOOLS, {
    planMode: () => false,
  });
  assert.equal(agentMode(ctx("tempo__upsert_company")), "user-approval");
  assert.equal(agentMode(ctx("create_task")), "user-approval");
  assert.equal(agentMode(ctx("tempo__search")), "not-applicable");
  assert.equal(agentMode(ctx("tempo__list_meetings")), "not-applicable");

  const planMode = writeToolApproval(TEMPO_WRITE_TOOLS, {
    planMode: () => true,
  });
  assert.equal(planMode(ctx("tempo__upsert_company")).type, "denied");
  assert.equal(planMode(ctx("tempo__search")), "not-applicable");
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

