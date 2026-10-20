import assert from "node:assert/strict";
import test from "node:test";
import { CONNECTION_IDS, connectionConfiguration, connectionSubjectForUser, isConnectionId } from "../lib/connections/catalog.ts";

test("only fixed provider ids are accepted", () => {
  assert.deepEqual(CONNECTION_IDS, ["vercel", "github", "neon", "notion", "linear", "sentry"]);
  assert.equal(isConnectionId("github"), true);
  assert.equal(isConnectionId("notion"), true);
  assert.equal(isConnectionId("other"), false);
  assert.equal(isConnectionId({ id: "github" }), false);
});

test("durable Connect grant subject matches eve's Better Auth principal", () => {
  assert.deepEqual(connectionSubjectForUser("user-one"), { type: "user", id: "user-one", issuer: "better-auth" });
  assert.notDeepEqual(connectionSubjectForUser("user-two"), connectionSubjectForUser("user-one"));
});

test("Vercel requires a connector and a pinned team and project", () => {
  assert.equal(connectionConfiguration("vercel", { VERCEL_CONNECTOR: "vercel/test" }).connector, null);
  assert.equal(connectionConfiguration("vercel", {
    VERCEL_CONNECTOR: "vercel/test", VERCEL_MCP_TEAM_ID: "team-a", VERCEL_MCP_PROJECT_ID: "project-a",
  }).connector, "vercel/test");
});

test("existing eve connections use their current connector names", () => {
  assert.equal(connectionConfiguration("notion", {}).connector, "notion");
  assert.equal(connectionConfiguration("linear", { LINEAR_CONNECTOR: "linear/team" }).connector, "linear/team");
  assert.equal(connectionConfiguration("sentry", {}).label, "Sentry");
});

test("GitHub is opt-in, while Neon never appears in production", () => {
  assert.equal(connectionConfiguration("github", {}).connector, null);
  assert.equal(connectionConfiguration("github", { GITHUB_CONNECTOR: "github/test" }).connector, "github/test");
  const neon = { NEON_CONNECTOR: "neon/test", NEON_MCP_PROJECT_ID: "dev-project", NEON_MCP_ROLE: "app_reader" };
  assert.equal(connectionConfiguration("neon", { ...neon, NEON_MCP_ROLE: "", NODE_ENV: "development" }).connector, null);
  assert.equal(connectionConfiguration("neon", { ...neon, NODE_ENV: "development" }).connector, "neon/test");
  assert.equal(connectionConfiguration("neon", { ...neon, NEON_PROJECT_ID: "dev-project", NODE_ENV: "development" }).connector, null);
  assert.equal(connectionConfiguration("neon", { ...neon, VERCEL_ENV: "production" }).connector, null);
  assert.equal(connectionConfiguration("neon", { ...neon, NODE_ENV: "production" }).connector, null);
  assert.equal(connectionConfiguration("neon", { ...neon, NODE_ENV: "production", VERCEL_ENV: "preview" }).connector, "neon/test");
});
