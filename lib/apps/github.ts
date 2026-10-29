import { assertPearlAppRepo, isPearlRepoName } from "./slug.ts";
import type { SeedFile } from "./seed.ts";

const GITHUB_API = "https://api.github.com";

type GithubUser = {
  readonly login: string;
};

type GithubRepo = {
  readonly name: string;
  readonly full_name: string;
  readonly private: boolean;
  readonly html_url: string;
  readonly default_branch: string;
};

async function githubFetch(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "pearl-builder",
      ...(init?.headers ?? {}),
    },
  });
}

async function githubJson<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await githubFetch(token, path, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub ${init?.method ?? "GET"} ${path} → ${res.status}: ${body.slice(0, 400)}`);
  }
  return (await res.json()) as T;
}

/** GitHub returns 409 (not always 404) when reading refs on a zero-commit repo. */
export function isEmptyGitRepositoryError(status: number, body: string): boolean {
  if (status === 404) return true;
  if (status !== 409) return false;
  return /git repository is empty/i.test(body);
}

function isNameAlreadyExistsError(status: number, body: string): boolean {
  if (status !== 422) return false;
  return /name already exists/i.test(body);
}

export async function getGithubLogin(token: string): Promise<string> {
  const user = await githubJson<GithubUser>(token, "/user");
  return user.login;
}

/**
 * Create a private `pearl-*` repo under the authenticated user and push the
 * seed as the initial commit via the Git Data API.
 *
 * Retries after a cancelled create can hit an empty leftover repo: on 422
 * "name already exists", adopt that repo and seed `main` only when it has no
 * commits yet.
 */
export async function createPearlRepo(args: {
  readonly token: string;
  readonly owner: string;
  readonly repo: string;
  readonly description: string;
  readonly files: readonly SeedFile[];
}): Promise<GithubRepo> {
  if (!isPearlRepoName(args.repo)) {
    throw new Error(`Refusing to create ${args.repo}: only pearl-* repos are allowed.`);
  }

  const createRes = await githubFetch(args.token, "/user/repos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: args.repo,
      description: args.description,
      private: true,
      auto_init: false,
      has_issues: false,
      has_projects: false,
      has_wiki: false,
    }),
  });

  let repo: GithubRepo;
  if (createRes.ok) {
    repo = (await createRes.json()) as GithubRepo;
  } else {
    const body = await createRes.text();
    if (!isNameAlreadyExistsError(createRes.status, body)) {
      throw new Error(
        `GitHub POST /user/repos → ${createRes.status}: ${body.slice(0, 400)}`,
      );
    }
    repo = await githubJson<GithubRepo>(
      args.token,
      `/repos/${args.owner}/${args.repo}`,
    );
  }

  const branch = "main";
  const base = `/repos/${args.owner}/${args.repo}`;
  const refRes = await githubFetch(args.token, `${base}/git/ref/heads/${branch}`);
  if (refRes.ok) {
    // Already seeded (or otherwise has commits); leave files alone.
    return repo;
  }

  const refBody = await refRes.text();
  if (!isEmptyGitRepositoryError(refRes.status, refBody)) {
    throw new Error(`GitHub GET ref → ${refRes.status}: ${refBody.slice(0, 400)}`);
  }

  await pushCommit({
    token: args.token,
    owner: args.owner,
    repo: args.repo,
    expectedOwner: args.owner,
    expectedRepo: args.repo,
    message: "Initial pearl mini app",
    files: args.files,
    branch,
  });

  return repo;
}

/** Commit and push files to an existing pearl-* repo (non-force). */
export async function pushCommit(args: {
  readonly token: string;
  readonly owner: string;
  readonly repo: string;
  readonly expectedOwner: string;
  readonly expectedRepo: string;
  readonly message: string;
  readonly files: readonly SeedFile[];
  readonly branch?: string;
}): Promise<{ readonly commitSha: string }> {
  assertPearlAppRepo({
    githubOwner: args.owner,
    githubRepo: args.repo,
    expectedOwner: args.expectedOwner,
    expectedRepo: args.expectedRepo,
  });

  const branch = args.branch ?? "main";
  const base = `/repos/${args.owner}/${args.repo}`;

  // Resolve current HEAD when the branch exists; otherwise start an orphan tree.
  // Empty repos return 409 "Git Repository is empty" (not only 404).
  let parentSha: string | null = null;
  let baseTreeSha: string | null = null;
  const refRes = await githubFetch(args.token, `${base}/git/ref/heads/${branch}`);
  if (refRes.ok) {
    const ref = (await refRes.json()) as { object: { sha: string } };
    parentSha = ref.object.sha;
    const commit = await githubJson<{ tree: { sha: string } }>(
      args.token,
      `${base}/git/commits/${parentSha}`,
    );
    baseTreeSha = commit.tree.sha;
  } else {
    const body = await refRes.text();
    if (!isEmptyGitRepositoryError(refRes.status, body)) {
      throw new Error(`GitHub GET ref → ${refRes.status}: ${body.slice(0, 400)}`);
    }
  }

  const blobs = await Promise.all(
    args.files.map(async (file) => {
      const blob = await githubJson<{ sha: string }>(args.token, `${base}/git/blobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: Buffer.from(file.content, "utf8").toString("base64"),
          encoding: "base64",
        }),
      });
      return {
        path: file.path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: blob.sha,
      };
    }),
  );

  const tree = await githubJson<{ sha: string }>(args.token, `${base}/git/trees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      base_tree: baseTreeSha ?? undefined,
      tree: blobs,
    }),
  });

  const commit = await githubJson<{ sha: string }>(args.token, `${base}/git/commits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: args.message,
      tree: tree.sha,
      parents: parentSha ? [parentSha] : [],
    }),
  });

  if (parentSha) {
    await githubJson(args.token, `${base}/git/refs/heads/${branch}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
  } else {
    await githubJson(args.token, `${base}/git/refs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
    });
  }

  return { commitSha: commit.sha };
}

/** List text files under the default branch (for seeding a sandbox). */
export async function listRepoFiles(args: {
  readonly token: string;
  readonly owner: string;
  readonly repo: string;
  readonly expectedOwner: string;
  readonly expectedRepo: string;
}): Promise<SeedFile[]> {
  assertPearlAppRepo({
    githubOwner: args.owner,
    githubRepo: args.repo,
    expectedOwner: args.expectedOwner,
    expectedRepo: args.expectedRepo,
  });

  const base = `/repos/${args.owner}/${args.repo}`;
  type TreeEntry = { path: string; type: string; sha: string };
  const tree = await githubJson<{ tree: TreeEntry[]; truncated: boolean }>(
    args.token,
    `${base}/git/trees/main?recursive=1`,
  );

  if (tree.truncated) {
    throw new Error("Repository tree is too large to sync in one pass.");
  }

  const blobs = tree.tree.filter(
    (entry) =>
      entry.type === "blob" &&
      !entry.path.startsWith("node_modules/") &&
      !entry.path.startsWith(".next/"),
  );

  const files: SeedFile[] = [];
  for (const entry of blobs) {
    const blob = await githubJson<{ content?: string; encoding?: string; size: number }>(
      args.token,
      `${base}/git/blobs/${entry.sha}`,
    );
    if (blob.size > 512_000) continue;
    if (blob.encoding !== "base64" || !blob.content) continue;
    const content = Buffer.from(blob.content.replace(/\n/g, ""), "base64").toString("utf8");
    // Skip obvious binaries.
    if (content.includes("\0")) continue;
    files.push({ path: entry.path, content });
  }
  return files;
}
