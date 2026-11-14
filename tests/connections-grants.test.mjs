import assert from "node:assert/strict";
import test from "node:test";

import {
  githubPushDeniedMessage,
  looksLikeGithubGrantDenial,
  vercelTokenUnavailableMessage,
} from "../lib/connections/grant-errors.ts";
import {
  GRANT_SCOPE_CATALOGS,
  missingFromGranted,
  requestedScopesFor,
} from "../lib/connections/grant-scopes.ts";
import {
  GITHUB_OAUTH_SCOPES,
  GMAIL_OAUTH_SCOPES,
} from "../lib/connections/oauth-scopes.ts";

test("requestedScopesFor returns catalog scopes for github and gmail", () => {
  assert.deepEqual(requestedScopesFor("github"), [...GITHUB_OAUTH_SCOPES]);
  assert.deepEqual(requestedScopesFor("gmail"), [...GMAIL_OAUTH_SCOPES]);
  assert.deepEqual(requestedScopesFor("vercel"), []);
  assert.deepEqual(GRANT_SCOPE_CATALOGS.github, GITHUB_OAUTH_SCOPES);
});

test("missingFromGranted finds compose and repo gaps", () => {
  assert.deepEqual(
    missingFromGranted(
      [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.compose",
      ],
      ["https://www.googleapis.com/auth/gmail.readonly"],
    ),
    ["https://www.googleapis.com/auth/gmail.compose"],
  );
  assert.deepEqual(
    missingFromGranted(["openid", "repo", "read:org"], ["openid", "read:org"]),
    ["repo"],
  );
  assert.equal(missingFromGranted(["repo"], undefined), undefined);
  assert.deepEqual(missingFromGranted(["repo"], ["repo", "gist"]), []);
});

test("grant denial copy points at Settings, not the user account", () => {
  const github = githubPushDeniedMessage("tonicagentic");
  assert.match(github, /Settings → GitHub/);
  assert.match(github, /tonicagentic/);
  assert.doesNotMatch(github, /your GitHub account lacks/i);

  const vercel = vercelTokenUnavailableMessage("missing connector");
  assert.match(vercel, /Settings → Vercel/);

  assert.equal(
    looksLikeGithubGrantDenial(
      "remote: Permission to tonicagentic/pearl denied (HTTP 403)",
    ),
    true,
  );
  assert.equal(looksLikeGithubGrantDenial("Everything up-to-date"), false);
});
