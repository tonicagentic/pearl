import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractEasBuildId,
  extractWatchHandles,
  mapEasBuildStatus,
  mapVercelReadyState,
  watchFromDeployVercelOutput,
  watchFromEasBuildOutput,
} from "../lib/watch/deploy.ts";

describe("mapVercelReadyState", () => {
  it("maps known readyStates", () => {
    assert.equal(mapVercelReadyState("READY"), "ready");
    assert.equal(mapVercelReadyState("ERROR"), "error");
    assert.equal(mapVercelReadyState("QUEUED"), "queued");
    assert.equal(mapVercelReadyState("BUILDING"), "building");
    assert.equal(mapVercelReadyState("CANCELED"), "canceled");
  });
});

describe("mapEasBuildStatus", () => {
  it("maps Expo build statuses", () => {
    assert.equal(mapEasBuildStatus("FINISHED"), "ready");
    assert.equal(mapEasBuildStatus("ERRORED"), "error");
    assert.equal(mapEasBuildStatus("IN_QUEUE"), "queued");
    assert.equal(mapEasBuildStatus("IN_PROGRESS"), "building");
    assert.equal(mapEasBuildStatus("CANCELED"), "canceled");
  });
});

describe("extractEasBuildId", () => {
  const id = "2d7f5b5f-bcb0-42e3-b5f2-d163789b89c3";

  it("reads a bare uuid string", () => {
    assert.equal(extractEasBuildId(id), id);
  });

  it("reads buildId from an object", () => {
    assert.equal(extractEasBuildId({ buildId: id }), id);
  });

  it("reads an MCP content-array fixture", () => {
    assert.equal(
      extractEasBuildId({
        content: [
          {
            type: "text",
            text: `Build Triggered\nBuild ID: ${id}\nStatus: in queue`,
          },
        ],
      }),
      id,
    );
  });
});

describe("watchFromDeployVercelOutput", () => {
  it("builds a building snapshot from a url", () => {
    const snap = watchFromDeployVercelOutput({
      status: "ok",
      target: "production",
      url: "https://my-agent-abc.vercel.app",
      projectId: "prj_123",
      teamId: "team_abc",
      state: "building",
    });
    assert.ok(snap);
    assert.equal(snap.provider, "vercel");
    assert.equal(snap.state, "building");
    assert.equal(snap.title, "Current production deployment");
    assert.equal(snap.deploymentId, "my-agent-abc.vercel.app");
  });
});

describe("watchFromEasBuildOutput", () => {
  it("builds a queued snapshot from buildId", () => {
    const id = "60e2fdf1-fc7a-4b08-89c3-fe53bb2ea311";
    const snap = watchFromEasBuildOutput(
      { buildId: id, status: "IN_QUEUE" },
      { platform: "ios", profile: "preview" },
    );
    assert.ok(snap);
    assert.equal(snap.provider, "eas");
    assert.equal(snap.state, "queued");
    assert.equal(snap.title, "EAS iOS preview");
    assert.equal(snap.buildId, id);
  });
});

describe("extractWatchHandles", () => {
  it("finds newest vercel and eas handles from child messages", () => {
    const vercelId = "https://preview-old.vercel.app";
    const vercelNew = "https://preview-new.vercel.app";
    const easOld = "11111111-1111-1111-1111-111111111111";
    const easNew = "22222222-2222-2222-2222-222222222222";
    const handles = extractWatchHandles({
      childMessages: [
        {
          parts: [
            {
              type: "tool",
              name: "deploy_vercel",
              state: "completed",
              output: { status: "ok", url: vercelId, target: "preview" },
            },
            {
              type: "tool",
              name: "expo__build_run",
              state: "completed",
              output: { buildId: easOld },
              input: { platform: "ios", buildProfile: "preview" },
            },
          ],
        },
        {
          parts: [
            {
              type: "tool",
              name: "deploy_vercel",
              state: "completed",
              output: {
                status: "ok",
                url: vercelNew,
                target: "production",
                state: "building",
              },
            },
            {
              type: "tool",
              name: "build_run",
              state: "completed",
              output: {
                content: [{ type: "text", text: `Build ID: ${easNew}` }],
              },
              input: { platform: "android", profile: "production" },
            },
          ],
        },
      ],
    });
    assert.equal(handles.vercel?.url, vercelNew);
    assert.equal(handles.vercel?.target, "production");
    assert.equal(handles.eas?.buildId, easNew);
    assert.equal(handles.eas?.title, "EAS Android production");
  });
});
