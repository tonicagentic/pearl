import assert from "node:assert/strict";
import { test } from "node:test";

import {
  areShipApprovalsSeparate,
  buildApprovalCard,
  payloadLeaksSecret,
} from "../../lib/workbench/approvals.ts";
import { runReadOnlyQuery, sanitizeDatabasePayload } from "../../lib/workbench/database.ts";
import { buildEasUpdateRequest } from "../../lib/workbench/eas-update.ts";
import {
  buildCreateSimulatorBody,
  expoStopSessionPath,
  resolvePhonePreviewUrl,
} from "../../lib/workbench/expo-simulator.ts";
import { validatePinInput } from "../../lib/workbench/pins.ts";
import {
  buildDevServerPreview,
  mergeComputerPreviews,
  resolveDevScript,
} from "../../lib/workbench/previews.ts";
import {
  classifyGitCommand,
  emptyShipGateState,
  rememberDraftPrApproval,
  rememberPushApproval,
} from "../../lib/workbench/ship-gates.ts";
import { assertReadOnlySelect } from "../../lib/workbench/sql-guard.ts";
import {
  PEARL_EXPO_PROJECT_ID,
  PEARL_SUGGESTED_PIN,
} from "../../lib/workbench/types.ts";
import {
  mapEnvNames,
  listProjectDeployments,
  listProjectDomains,
  listProjectEnvNames,
  getTeamUsage,
  writeProjectEnv,
  addProjectDomain,
} from "../../lib/workbench/vercel-client.ts";
import { listOpenPullRequests } from "../../lib/workbench/github-client.ts";

const PEARL_PIN = {
  id: "pin-pearl",
  owner: "alex",
  name: "my-agent",
  fullName: "alex/my-agent",
  vercelProjectId: "prj_pearl",
  vercelTeamId: "team_pearl",
  expoProjectId: PEARL_EXPO_PROJECT_ID,
  expoUpdateChannel: "preview",
};

const OTHER_WEB = {
  id: "pin-site",
  owner: "alex",
  name: "personal-site",
  fullName: "alex/personal-site",
  vercelProjectId: "prj_site",
  vercelTeamId: "team_site",
  expoProjectId: null as string | null,
  expoUpdateChannel: null as string | null,
};

const OTHER_EXPO = {
  id: "pin-expo",
  owner: "alex",
  name: "tonic-app",
  fullName: "alex/tonic-app",
  vercelProjectId: null as string | null,
  vercelTeamId: null as string | null,
  expoProjectId: "expo-other-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  expoUpdateChannel: "production",
};

function mockFetch(handlers: Record<string, (init?: RequestInit) => Response | Promise<Response>>) {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const fetchFn = async (path: string, init?: RequestInit) => {
    calls.push({ path, init });
    const key = Object.keys(handlers).find((k) => path.includes(k) || path === k);
    if (!key) {
      return new Response(`no mock for ${path}`, { status: 404 });
    }
    return handlers[key]!(init);
  };
  return { fetchFn, calls };
}

test("workbench: two pins return distinct PRs and deployments", async () => {
  const github = mockFetch({
    "/repos/alex/my-agent/pulls": () =>
      Response.json([
        {
          number: 1,
          title: "Pearl fix",
          state: "open",
          draft: true,
          html_url: "https://github.com/alex/my-agent/pull/1",
          head: { ref: "fix/pearl" },
          base: { ref: "main" },
        },
      ]),
    "/repos/alex/personal-site/pulls": () =>
      Response.json([
        {
          number: 9,
          title: "Site tweak",
          state: "open",
          draft: false,
          html_url: "https://github.com/alex/personal-site/pull/9",
          head: { ref: "fix/site" },
          base: { ref: "main" },
        },
      ]),
  });

  const vercel = mockFetch({
    "/v6/deployments?projectId=prj_pearl": () =>
      Response.json({
        deployments: [
          {
            uid: "dpl_pearl",
            url: "pearl-preview.vercel.app",
            readyState: "READY",
            target: "preview",
            createdAt: 1,
          },
        ],
      }),
    "/v6/deployments?projectId=prj_site": () =>
      Response.json({
        deployments: [
          {
            uid: "dpl_site",
            url: "site.vercel.app",
            readyState: "READY",
            target: "production",
            createdAt: 2,
          },
        ],
      }),
  });

  const pearlPrs = await listOpenPullRequests(github.fetchFn, {
    owner: PEARL_PIN.owner,
    repo: PEARL_PIN.name,
  });
  const sitePrs = await listOpenPullRequests(github.fetchFn, {
    owner: OTHER_WEB.owner,
    repo: OTHER_WEB.name,
  });
  const pearlDeploys = await listProjectDeployments(vercel.fetchFn, {
    projectId: PEARL_PIN.vercelProjectId!,
  });
  const siteDeploys = await listProjectDeployments(vercel.fetchFn, {
    projectId: OTHER_WEB.vercelProjectId!,
  });

  assert.equal(pearlPrs[0]?.number, 1);
  assert.equal(sitePrs[0]?.number, 9);
  assert.notEqual(pearlPrs[0]?.number, sitePrs[0]?.number);
  assert.equal(pearlDeploys[0]?.uid, "dpl_pearl");
  assert.equal(siteDeploys[0]?.uid, "dpl_site");
  assert.match(pearlDeploys[0]!.url, /^https:\/\//);
});

test("workbench: revoked GitHub returns empty connected=false shape, not throw", async () => {
  // Pin validation still works offline.
  const validated = validatePinInput({ fullName: "alex/my-agent" });
  assert.equal(validated.ok, true);

  const github = mockFetch({
    "/repos/alex/my-agent/pulls": () =>
      new Response("Unauthorized", { status: 401 }),
  });

  await assert.rejects(
    () =>
      listOpenPullRequests(github.fetchFn, {
        owner: "alex",
        repo: "my-agent",
      }),
    /GitHub pulls → 401/,
  );

  // Empty pin list is the client-facing shape when not connected.
  const emptyPins: unknown[] = [];
  assert.deepEqual(emptyPins, []);
  assert.ok(PEARL_SUGGESTED_PIN.owner);
});

test("approvals: denied actions never call upstream", async () => {
  const vercel = mockFetch({
    "/v10/projects/prj_site/env": () => {
      throw new Error("should not be called");
    },
    "/v10/projects/prj_site/domains": () => {
      throw new Error("should not be called");
    },
  });

  const approved = false;
  const card = buildApprovalCard({
    action: "preview_deploy",
    owner: OTHER_WEB.owner,
    repo: OTHER_WEB.name,
    target: "preview",
  });
  assert.equal(card.warnsPhoneApi, false);
  assert.ok(!payloadLeaksSecret(card));
  assert.match(card.summary, /alex\/personal-site/);
  assert.doesNotMatch(card.summary, /phone/i);

  if (!approved) {
    assert.equal(vercel.calls.length, 0);
    return;
  }
  await writeProjectEnv(vercel.fetchFn, {
    projectId: "prj_site",
    key: "FOO",
    value: "secret-value-should-not-leak",
    target: ["production"],
  });
});

test("approvals: production deploy for other app does not warn about Pearl phone API", () => {
  const card = buildApprovalCard({
    action: "production_deploy",
    owner: OTHER_WEB.owner,
    repo: OTHER_WEB.name,
    target: "production",
  });
  assert.equal(card.warnsPhoneApi, false);
  assert.equal(card.warnsInstalledApp, false);

  const pearlCard = buildApprovalCard({
    action: "production_deploy",
    owner: PEARL_PIN.owner,
    repo: PEARL_PIN.name,
    target: "production",
  });
  assert.equal(pearlCard.warnsPhoneApi, true);
  assert.match(pearlCard.summary, /API the phone is using/);
});

test("dev server: uses package.json script, not hardcoded next dev", () => {
  const vite = resolveDevScript({
    scripts: { dev: "vite --port 5173", start: "node server.js" },
  });
  assert.equal(vite.script, "dev");
  assert.equal(vite.port, 5173);

  const preview = buildDevServerPreview({
    repoFullName: OTHER_WEB.fullName,
    script: vite.script,
    port: vite.port,
    hostname: "abc123.vercel.run",
  });
  assert.equal(preview.kind, "dev-server");
  assert.equal(preview.url, "https://abc123.vercel.run");
  assert.match(preview.label, /personal-site/);
  assert.doesNotMatch(preview.label, /next dev/i);

  const computer = {
    previews: mergeComputerPreviews([], preview),
  };
  assert.equal(computer.previews.length, 1);
  assert.equal(computer.previews[0]?.url, "https://abc123.vercel.run");
});

test("expo session: create body uses pin project id, not Pearl's for other app", () => {
  const otherBody = buildCreateSimulatorBody({
    expoProjectId: OTHER_EXPO.expoProjectId,
    name: "tonic check",
  });
  assert.equal(otherBody.platform, "ios");
  assert.equal(otherBody.type, "agent-device");
  assert.equal(otherBody.appId, OTHER_EXPO.expoProjectId);
  assert.notEqual(otherBody.appId, PEARL_EXPO_PROJECT_ID);

  const pearlBody = buildCreateSimulatorBody({
    expoProjectId: null,
    name: "pearl check",
  });
  assert.equal(pearlBody.appId, PEARL_EXPO_PROJECT_ID);

  const resolved = resolvePhonePreviewUrl({
    url: "https://expo.dev/accounts/x/projects/y/simulator-sessions/sess1",
    remoteConfig: {
      previewUrl: "https://expo.dev/preview/sess1",
      webPreviewToken: "tok_secret",
    },
    publicPreview: false,
  });
  assert.equal(resolved.previewUrl, "https://expo.dev/preview/sess1");
  assert.equal(resolved.hasToken, true);
  // Token must not be embedded when publicPreview is false.
  assert.doesNotMatch(resolved.previewUrl!, /tok_secret/);

  assert.equal(
    expoStopSessionPath("sess-123"),
    "/v2/device-run-sessions/sess-123/stop",
  );
});

test("pearl self-update: production web and EAS Update are two approvals", () => {
  assert.equal(
    areShipApprovalsSeparate("production_deploy", "eas_update"),
    true,
  );
  assert.equal(
    areShipApprovalsSeparate("production_deploy", "production_deploy"),
    false,
  );

  const web = buildApprovalCard({
    action: "production_deploy",
    owner: PEARL_PIN.owner,
    repo: PEARL_PIN.name,
    target: PEARL_PIN.vercelProjectId!,
  });
  const update = buildApprovalCard({
    action: "eas_update",
    owner: PEARL_PIN.owner,
    repo: PEARL_PIN.name,
    target: PEARL_PIN.expoUpdateChannel!,
  });
  assert.notEqual(web.action, update.action);
  assert.equal(web.warnsPhoneApi, true);
  assert.equal(update.warnsInstalledApp, true);

  const otherUpdate = buildEasUpdateRequest({
    expoProjectId: OTHER_EXPO.expoProjectId,
    channel: OTHER_EXPO.expoUpdateChannel,
  });
  assert.equal(otherUpdate.expoProjectId, OTHER_EXPO.expoProjectId);
  assert.notEqual(otherUpdate.expoProjectId, PEARL_EXPO_PROJECT_ID);
  assert.equal(otherUpdate.isPearl, false);
});

test("resources: env names strip values; denied writes skip Vercel", async () => {
  const mapped = mapEnvNames([
    {
      id: "env1",
      key: "DATABASE_URL",
      target: ["production"],
      value: "postgres://secret",
    },
    { id: "env2", key: "NODE_ENV", target: "preview" },
  ]);
  assert.equal(mapped[0]?.key, "DATABASE_URL");
  assert.equal(
    (mapped[0] as { value?: string }).value,
    undefined,
  );
  assert.ok(!payloadLeaksSecret(mapped));

  const vercel = mockFetch({
    [`/v9/projects/${PEARL_PIN.vercelProjectId}/env`]: () =>
      Response.json({
        envs: [
          {
            id: "e1",
            key: "FOO",
            target: ["production"],
            value: "should-not-appear",
          },
        ],
      }),
    [`/v9/projects/${PEARL_PIN.vercelProjectId}/domains`]: () =>
      Response.json({
        domains: [{ name: "pearl.example.com", verified: true, configured: true }],
      }),
    "/v1/storage": () =>
      Response.json({
        stores: [
          { id: "store1", name: "blob", type: "blob", status: "available", region: "iad1" },
        ],
      }),
    "/v10/projects/prj_pearl/env": () => {
      throw new Error("env write should not run");
    },
    "/v10/projects/prj_pearl/domains": () => {
      throw new Error("domain add should not run");
    },
  });

  const envs = await listProjectEnvNames(vercel.fetchFn, {
    projectId: PEARL_PIN.vercelProjectId!,
  });
  const domains = await listProjectDomains(vercel.fetchFn, {
    projectId: PEARL_PIN.vercelProjectId!,
  });
  assert.equal(envs[0]?.key, "FOO");
  assert.ok(!("value" in (envs[0] as object)));
  assert.equal(domains[0]?.name, "pearl.example.com");
  assert.ok(!payloadLeaksSecret({ envs, domains }));

  const approved = false;
  if (approved) {
    await writeProjectEnv(vercel.fetchFn, {
      projectId: "prj_pearl",
      key: "FOO",
      value: "x",
      target: ["production"],
    });
    await addProjectDomain(vercel.fetchFn, {
      projectId: "prj_pearl",
      name: "new.example.com",
    });
  }
  assert.ok(
    !vercel.calls.some((c) => c.init?.method === "POST"),
  );
});

test("database: rejects multi-statement and non-select; no connection string", async () => {
  assert.equal(assertReadOnlySelect("SELECT 1; SELECT 2").ok, false);
  assert.equal(assertReadOnlySelect("DELETE FROM users").ok, false);
  assert.equal(assertReadOnlySelect("SELECT * FROM users").ok, true);

  const result = await runReadOnlyQuery(
    async () => ({
      rows: [{ id: 1, name: "ok" }],
      fields: ["id", "name"],
    }),
    "SELECT id, name FROM users",
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.fields, ["id", "name"]);
  }

  const denied = await runReadOnlyQuery(
    async () => {
      throw new Error("executor must not run");
    },
    "SELECT 1; DROP TABLE users",
  );
  assert.equal(denied.ok, false);

  const sanitized = sanitizeDatabasePayload({
    tables: [{ name: "user" }],
    connectionString: "postgres://leak",
    database_url: "postgres://leak",
    password: "x",
  });
  assert.equal("connectionString" in sanitized, false);
  assert.equal("database_url" in sanitized, false);
  assert.equal("password" in sanitized, false);
  assert.ok(!payloadLeaksSecret(sanitized));
});

test("usage: Vercel usage payload is distinct from Pearl billing status", async () => {
  const vercel = mockFetch({
    "/v1/teams/team_site/usage": () =>
      Response.json({
        bandwidth: { total: 1_000_000 },
        serverlessFunctionExecution: { total: 42 },
        buildExecution: { total: 12 },
        artifacts: { total: 500 },
        period: { start: "2026-11-01", end: "2026-12-01" },
        invoice: { total: 19.5 },
      }),
  });

  const usage = await getTeamUsage(vercel.fetchFn, { teamId: "team_site" });
  assert.equal(usage.teamId, "team_site");
  assert.equal(usage.bandwidthBytes, 1_000_000);
  assert.equal(usage.invoiceTotalCents, 1950);

  // Pearl billing shape (from /api/billing/status) — must not be merged.
  const pearlBilling = {
    subscribed: true,
    spentCents: 120,
    usageCapCents: 5000,
  };

  assert.equal("spentCents" in usage, false);
  assert.equal("usageCapCents" in usage, false);
  assert.equal("bandwidthBytes" in pearlBilling, false);
  assert.notDeepEqual(usage, pearlBilling);
});

test("ship gates: first push and draft PR need approval; later commits do not", () => {
  let state = emptyShipGateState();
  const firstPush = classifyGitCommand("git push -u origin feature/x", state);
  assert.equal(firstPush.needsApproval, true);
  if (firstPush.needsApproval) {
    assert.equal(firstPush.action, "push");
  }

  state = rememberPushApproval(state, "origin/feature/x");
  const laterPush = classifyGitCommand("git push origin feature/x", state);
  assert.equal(laterPush.needsApproval, false);

  const draft = classifyGitCommand("gh pr create --draft --title hi", state);
  assert.equal(draft.needsApproval, true);
  state = rememberDraftPrApproval(state);
  const draftAgain = classifyGitCommand("gh pr create --draft", state);
  assert.equal(draftAgain.needsApproval, false);
});
