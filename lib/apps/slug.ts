/** Repo and slug rules for builder-owned mini apps. */

export const PEARL_REPO_PREFIX = "pearl-";

const SLUG_BODY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Normalize a user-facing slug to the repo name `pearl-<slug>`.
 * Accepts either `my-app` or `pearl-my-app`.
 */
export function normalizePearlSlug(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;

  const body = raw.startsWith(PEARL_REPO_PREFIX)
    ? raw.slice(PEARL_REPO_PREFIX.length)
    : raw;

  if (!body || body.length > 80 || !SLUG_BODY.test(body)) {
    return null;
  }

  // Guard against `pearl-pearl-…` and empty after strip.
  if (body.startsWith(PEARL_REPO_PREFIX)) {
    return null;
  }

  return `${PEARL_REPO_PREFIX}${body}`;
}

/** True when the repo name is a builder-owned `pearl-*` slug. */
export function isPearlRepoName(repo: string): boolean {
  return normalizePearlSlug(repo) === repo.trim().toLowerCase();
}

/** Full `owner/repo` for a pearl mini app. */
export function pearlFullName(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

/**
 * Rejects a deploy target that is not this user's pearl mini-app row.
 * Used by publish and any GitHub write path.
 */
export function assertPearlAppRepo(args: {
  readonly githubOwner: string;
  readonly githubRepo: string;
  readonly expectedOwner: string;
  readonly expectedRepo: string;
}): void {
  if (!isPearlRepoName(args.githubRepo)) {
    throw new Error(
      `Refusing to touch ${args.githubOwner}/${args.githubRepo}: only pearl-* repos are allowed.`,
    );
  }
  if (
    args.githubOwner.toLowerCase() !== args.expectedOwner.toLowerCase() ||
    args.githubRepo.toLowerCase() !== args.expectedRepo.toLowerCase()
  ) {
    throw new Error(
      `Refusing to touch ${args.githubOwner}/${args.githubRepo}: it is not this mini app's repo.`,
    );
  }
}
