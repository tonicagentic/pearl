import assert from "node:assert/strict";
import test from "node:test";

import { isAppSourcePath } from "../lib/agent/writing-sandbox-paths.ts";

test("writing sandbox allows prose and design paths", () => {
  assert.equal(isAppSourcePath("notes.md"), false);
  assert.equal(isAppSourcePath("/workspace/docs/plan.md"), false);
  assert.equal(isAppSourcePath("brief.html"), false);
  assert.equal(isAppSourcePath("logo.svg"), false);
  assert.equal(isAppSourcePath("flow.mmd"), false);
  assert.equal(isAppSourcePath("mock.scene.json"), false);
});

test("writing sandbox refuses app source paths", () => {
  assert.equal(isAppSourcePath("package.json"), true);
  assert.equal(isAppSourcePath("tsconfig.json"), true);
  assert.equal(isAppSourcePath("next.config.ts"), true);
  assert.equal(isAppSourcePath("app/page.tsx"), true);
  assert.equal(isAppSourcePath("src/index.ts"), true);
  assert.equal(isAppSourcePath("lib/auth.ts"), true);
  assert.equal(isAppSourcePath("server.ts"), true);
});
