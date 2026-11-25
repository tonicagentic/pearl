import assert from "node:assert/strict";
import test from "node:test";

import {
  githubPushDeniedMessage,
  looksLikeGithubGrantDenial,
} from "../lib/connections/grant-errors.ts";

test("ship-access denial helpers stay Connect-scoped", () => {
  assert.equal(
    looksLikeGithubGrantDenial(
      "remote: Write access to repository not granted (HTTP 403)",
    ),
    true,
  );
  assert.equal(
    looksLikeGithubGrantDenial("Permission denied (publickey)"),
    false,
  );

  const msg = githubPushDeniedMessage(
    "tonicagentic",
    "https://github.com/settings/connections/applications/Iv1.abc",
  );
  assert.match(msg, /tonicagentic/);
  assert.match(msg, /settings\/connections\/applications\/Iv1\.abc/);
  assert.doesNotMatch(msg, /your GitHub account lacks/i);
});
