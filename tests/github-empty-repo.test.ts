import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  createPearlRepo,
  isEmptyGitRepositoryError,
  pushCommit,
} from "../lib/apps/github.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("isEmptyGitRepositoryError treats 404 and empty-repo 409 as missing branch", () => {
  assert.equal(isEmptyGitRepositoryError(404, ""), true);
  assert.equal(
    isEmptyGitRepositoryError(409, '{"message":"Git Repository is empty."}'),
    true,
  );
  assert.equal(isEmptyGitRepositoryError(409, '{"message":"Conflict"}'), false);
  assert.equal(isEmptyGitRepositoryError(500, "Git Repository is empty."), false);
});

type RecordedCall = {
  readonly method: string;
  readonly path: string;
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubGithub(handler: (method: string, path: string) => Response | undefined) {
  const calls: RecordedCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    assert.ok(url.startsWith("https://api.github.com"));
    const path = url.slice("https://api.github.com".length);
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ method, path });
    const res = handler(method, path);
    if (!res) {
      throw new Error(`Unexpected GitHub call: ${method} ${path}`);
    }
    return res;
  }) as typeof fetch;
  return calls;
}

const seedFiles = [{ path: "README.md", content: "# Tonic\n" }];

const sampleRepo = {
  name: "pearl-tonic",
  full_name: "alice/pearl-tonic",
  private: true,
  html_url: "https://github.com/alice/pearl-tonic",
  default_branch: "main",
};

test("pushCommit seeds main when GitHub returns 409 Git Repository is empty", async () => {
  const calls = stubGithub((method, path) => {
    if (method === "GET" && path === "/repos/alice/pearl-tonic/git/ref/heads/main") {
      return textResponse(409, '{"message":"Git Repository is empty."}');
    }
    if (method === "POST" && path === "/repos/alice/pearl-tonic/git/blobs") {
      return jsonResponse(201, { sha: "blob1" });
    }
    if (method === "POST" && path === "/repos/alice/pearl-tonic/git/trees") {
      return jsonResponse(201, { sha: "tree1" });
    }
    if (method === "POST" && path === "/repos/alice/pearl-tonic/git/commits") {
      return jsonResponse(201, { sha: "commit1" });
    }
    if (method === "POST" && path === "/repos/alice/pearl-tonic/git/refs") {
      return jsonResponse(201, { ref: "refs/heads/main" });
    }
    return undefined;
  });

  const result = await pushCommit({
    token: "tok",
    owner: "alice",
    repo: "pearl-tonic",
    expectedOwner: "alice",
    expectedRepo: "pearl-tonic",
    message: "Initial pearl mini app",
    files: seedFiles,
  });

  assert.equal(result.commitSha, "commit1");
  assert.ok(calls.some((c) => c.method === "POST" && c.path.endsWith("/git/blobs")));
  assert.ok(calls.some((c) => c.method === "POST" && c.path.endsWith("/git/trees")));
  assert.ok(calls.some((c) => c.method === "POST" && c.path.endsWith("/git/commits")));
  assert.ok(
    calls.some((c) => c.method === "POST" && c.path === "/repos/alice/pearl-tonic/git/refs"),
  );
  assert.ok(
    !calls.some(
      (c) =>
        c.method === "PATCH" &&
        c.path === "/repos/alice/pearl-tonic/git/refs/heads/main",
    ),
  );
});

test("pushCommit patches an existing branch on 200", async () => {
  const calls = stubGithub((method, path) => {
    if (method === "GET" && path === "/repos/alice/pearl-tonic/git/ref/heads/main") {
      return jsonResponse(200, { object: { sha: "parent1" } });
    }
    if (method === "GET" && path === "/repos/alice/pearl-tonic/git/commits/parent1") {
      return jsonResponse(200, { tree: { sha: "basetree" } });
    }
    if (method === "POST" && path === "/repos/alice/pearl-tonic/git/blobs") {
      return jsonResponse(201, { sha: "blob2" });
    }
    if (method === "POST" && path === "/repos/alice/pearl-tonic/git/trees") {
      return jsonResponse(201, { sha: "tree2" });
    }
    if (method === "POST" && path === "/repos/alice/pearl-tonic/git/commits") {
      return jsonResponse(201, { sha: "commit2" });
    }
    if (
      method === "PATCH" &&
      path === "/repos/alice/pearl-tonic/git/refs/heads/main"
    ) {
      return jsonResponse(200, { object: { sha: "commit2" } });
    }
    return undefined;
  });

  const result = await pushCommit({
    token: "tok",
    owner: "alice",
    repo: "pearl-tonic",
    expectedOwner: "alice",
    expectedRepo: "pearl-tonic",
    message: "Publish pearl-tonic from Pearl",
    files: seedFiles,
  });

  assert.equal(result.commitSha, "commit2");
  assert.ok(
    calls.some(
      (c) =>
        c.method === "PATCH" &&
        c.path === "/repos/alice/pearl-tonic/git/refs/heads/main",
    ),
  );
  assert.ok(
    !calls.some(
      (c) => c.method === "POST" && c.path === "/repos/alice/pearl-tonic/git/refs",
    ),
  );
});

test("createPearlRepo adopts an existing empty repo on 422 and seeds main", async () => {
  let refLookups = 0;
  const calls = stubGithub((method, path) => {
    if (method === "POST" && path === "/user/repos") {
      return textResponse(
        422,
        '{"message":"Repository creation failed.","errors":[{"message":"name already exists on this account"}]}',
      );
    }
    if (method === "GET" && path === "/repos/alice/pearl-tonic") {
      return jsonResponse(200, sampleRepo);
    }
    if (method === "GET" && path === "/repos/alice/pearl-tonic/git/ref/heads/main") {
      refLookups += 1;
      return textResponse(409, '{"message":"Git Repository is empty."}');
    }
    if (method === "POST" && path === "/repos/alice/pearl-tonic/git/blobs") {
      return jsonResponse(201, { sha: "blob1" });
    }
    if (method === "POST" && path === "/repos/alice/pearl-tonic/git/trees") {
      return jsonResponse(201, { sha: "tree1" });
    }
    if (method === "POST" && path === "/repos/alice/pearl-tonic/git/commits") {
      return jsonResponse(201, { sha: "commit1" });
    }
    if (method === "POST" && path === "/repos/alice/pearl-tonic/git/refs") {
      return jsonResponse(201, { ref: "refs/heads/main" });
    }
    return undefined;
  });

  const repo = await createPearlRepo({
    token: "tok",
    owner: "alice",
    repo: "pearl-tonic",
    description: "Pearl mini app: Tonic",
    files: seedFiles,
  });

  assert.equal(repo.name, "pearl-tonic");
  assert.equal(refLookups, 2); // createPearlRepo check + pushCommit
  assert.ok(calls.some((c) => c.method === "GET" && c.path === "/repos/alice/pearl-tonic"));
  assert.ok(
    calls.some((c) => c.method === "POST" && c.path === "/repos/alice/pearl-tonic/git/refs"),
  );
});

test("createPearlRepo leaves an already-seeded existing repo alone", async () => {
  const calls = stubGithub((method, path) => {
    if (method === "POST" && path === "/user/repos") {
      return textResponse(
        422,
        '{"message":"Repository creation failed.","errors":[{"message":"name already exists on this account"}]}',
      );
    }
    if (method === "GET" && path === "/repos/alice/pearl-tonic") {
      return jsonResponse(200, sampleRepo);
    }
    if (method === "GET" && path === "/repos/alice/pearl-tonic/git/ref/heads/main") {
      return jsonResponse(200, { object: { sha: "already" } });
    }
    return undefined;
  });

  const repo = await createPearlRepo({
    token: "tok",
    owner: "alice",
    repo: "pearl-tonic",
    description: "Pearl mini app: Tonic",
    files: seedFiles,
  });

  assert.equal(repo.full_name, "alice/pearl-tonic");
  assert.ok(!calls.some((c) => c.path.endsWith("/git/blobs")));
  assert.ok(!calls.some((c) => c.path.endsWith("/git/commits")));
});
