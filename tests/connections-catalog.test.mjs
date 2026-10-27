import assert from "node:assert/strict";
import test from "node:test";
import {
  CONNECTION_READONLY_ALLOWLISTS,
  CONNECTION_WRITE_BLOCKLISTS,
  looksLikeWriteOrLogTool,
} from "../agent/lib/connection-allowlists.ts";
import {
  CONNECTION_IDS,
  connectionConfiguration,
  connectionSubjectForUser,
  isConnectionId,
} from "../lib/connections/catalog.ts";
import {
  GITHUB_OAUTH_SCOPES,
  XERO_OAUTH_SCOPES,
} from "../lib/connections/oauth-scopes.ts";

test("only fixed provider ids are accepted", () => {
  assert.deepEqual(CONNECTION_IDS, [
    "gmail",
    "calendar",
    "drive",
    "github",
    "vercel",
    "xero",
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

