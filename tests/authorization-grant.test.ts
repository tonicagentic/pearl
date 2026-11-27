import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  authorizationGrantView,
  resolveAuthorizationConnectionId,
} from "../lib/chat/authorization-grant.ts";

describe("resolveAuthorizationConnectionId", () => {
  it("maps raw GitHub Connect ids to github", () => {
    assert.equal(
      resolveAuthorizationConnectionId({
        name: "git__gh__api.githubcopilot.com_pearl-github",
      }),
      "github",
    );
    assert.equal(
      resolveAuthorizationConnectionId({ name: "pearl-github" }),
      "github",
    );
  });
});

describe("authorizationGrantView", () => {
  it("shows GitHub branding instead of the connector id", () => {
    const view = authorizationGrantView({
      state: "completed",
      name: "git__gh__api.githubcopilot.com_pearl-github",
      instructions: "Authorization required for",
      description: "Authorization required for git__gh__api.githubcopilot.com_pearl-github",
      outcome: "authorized",
    });
    assert.equal(view.capability, "Connect GitHub");
    assert.equal(view.markId, "github");
    assert.equal(view.connectionId, "github");
    assert.deepEqual(view.reach, [
      "Triage PRs, issues, CI, and publish flows",
    ]);
    assert.equal(view.scope, "session");
    assert.ok(
      !view.reach.some((line) => line.includes("git__gh__")),
      "raw connector ids stay out of reach",
    );
  });

  it("maps declined outcomes to denied", () => {
    const view = authorizationGrantView({
      state: "completed",
      name: "gmail",
      displayName: "Gmail",
      outcome: "declined",
    });
    assert.equal(view.scope, "denied");
    assert.equal(view.capability, "Connect Gmail");
    assert.equal(view.markId, "gmail");
  });

  it("stays pending while required", () => {
    const view = authorizationGrantView({
      state: "required",
      name: "vercel",
      displayName: "Vercel",
    });
    assert.equal(view.scope, "pending");
    assert.equal(view.capability, "Connect Vercel");
    assert.ok(view.reach.includes("Projects, deployments, and logs"));
  });
});
