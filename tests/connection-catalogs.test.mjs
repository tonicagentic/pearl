import assert from "node:assert/strict";
import test from "node:test";

import { walkGithubRepoPages } from "../lib/repos/github-repos.ts";
import { walkVercelProjectPages } from "../lib/connections/vercel-projects.ts";

function repo(id) {
  return {
    id,
    name: `repo-${id}`,
    fullName: `owner/repo-${id}`,
    private: false,
    description: null,
    htmlUrl: `https://github.com/owner/repo-${id}`,
    updatedAt: null,
  };
}

test("walkGithubRepoPages stops when Link has no next", async () => {
  const calls = [];
  const catalog = await walkGithubRepoPages({
    maxPages: 5,
    fetchPage: async (page) => {
      calls.push(page);
      return {
        connected: true,
        repos: [repo(page)],
        page,
        perPage: 100,
        hasNext: page < 2,
      };
    },
  });

  assert.deepEqual(calls, [1, 2]);
  assert.equal(catalog.connected, true);
  assert.equal(catalog.truncated, false);
  assert.equal(catalog.repos.length, 2);
});

test("walkGithubRepoPages sets truncated at the page cap", async () => {
  const catalog = await walkGithubRepoPages({
    maxPages: 3,
    fetchPage: async (page) => ({
      connected: true,
      repos: [repo(page)],
      page,
      perPage: 100,
      hasNext: true,
    }),
  });

  assert.equal(catalog.connected, true);
  assert.equal(catalog.truncated, true);
  assert.equal(catalog.repos.length, 3);
});

test("walkGithubRepoPages forwards not-connected", async () => {
  const catalog = await walkGithubRepoPages({
    fetchPage: async () => ({
      connected: false,
      repos: [],
      page: 1,
      perPage: 100,
      hasNext: false,
      message: "Connect GitHub",
    }),
  });

  assert.equal(catalog.connected, false);
  assert.equal(catalog.message, "Connect GitHub");
  assert.equal(catalog.truncated, false);
});

test("walkVercelProjectPages advances until pagination.next is null", async () => {
  const untils = [];
  const catalog = await walkVercelProjectPages({
    maxPages: 5,
    fetchPage: async (until) => {
      untils.push(until);
      if (until == null) {
        return {
          projects: [
            {
              id: "prj_1",
              name: "one",
              framework: null,
              updatedAt: 2,
              teamId: null,
              teamName: null,
              teamSlug: null,
              dashboardUrl: "https://vercel.com/u/one",
            },
          ],
          nextUntil: 100,
          forbidden: false,
        };
      }
      return {
        projects: [
          {
            id: "prj_2",
            name: "two",
            framework: "nextjs",
            updatedAt: 1,
            teamId: null,
            teamName: null,
            teamSlug: null,
            dashboardUrl: "https://vercel.com/u/two",
          },
        ],
        nextUntil: null,
        forbidden: false,
      };
    },
  });

  assert.deepEqual(untils, [null, 100]);
  assert.equal(catalog.forbidden, false);
  assert.equal(catalog.truncated, false);
  assert.equal(catalog.projects.length, 2);
});

test("walkVercelProjectPages sets truncated at the page cap", async () => {
  const catalog = await walkVercelProjectPages({
    maxPages: 2,
    fetchPage: async (until) => ({
      projects: [
        {
          id: `prj_${until ?? 0}`,
          name: "p",
          framework: null,
          updatedAt: null,
          teamId: null,
          teamName: null,
          teamSlug: null,
          dashboardUrl: "https://vercel.com/u/p",
        },
      ],
      nextUntil: (until ?? 0) + 1,
      forbidden: false,
    }),
  });

  assert.equal(catalog.truncated, true);
  assert.equal(catalog.projects.length, 2);
});

test("walkVercelProjectPages reports forbidden without dropping prior pages", async () => {
  const catalog = await walkVercelProjectPages({
    fetchPage: async () => ({
      projects: [],
      nextUntil: null,
      forbidden: true,
    }),
  });

  assert.equal(catalog.forbidden, true);
  assert.equal(catalog.projects.length, 0);
  assert.equal(catalog.truncated, false);
});
