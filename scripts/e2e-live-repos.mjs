#!/usr/bin/env node
/**
 * Opt-in live check: list GitHub repos for the signed-in Connect token.
 * Set E2E_LIVE=1 and GITHUB_TOKEN (or rely on env the operator provides).
 * Never pushes, deploys, or mutates.
 *
 * Usage: E2E_LIVE=1 GITHUB_TOKEN=… node scripts/e2e-live-repos.mjs
 */

if (process.env.E2E_LIVE !== "1") {
  console.log("Skip: set E2E_LIVE=1 to list real repos (read-only).");
  process.exit(0);
}

const token = process.env.GITHUB_TOKEN?.trim();
if (!token) {
  console.error("GITHUB_TOKEN is required when E2E_LIVE=1.");
  process.exit(1);
}

const res = await fetch(
  "https://api.github.com/user/repos?per_page=5&sort=pushed&affiliation=owner,collaborator,organization_member",
  {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  },
);

if (!res.ok) {
  console.error(`GitHub list failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}

const repos = await res.json();
for (const repo of repos) {
  console.log(`${repo.full_name}\t${repo.html_url}`);
}
console.log(`Listed ${repos.length} repos (read-only).`);
