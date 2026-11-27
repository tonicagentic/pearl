"use client";

import type { ConnectionGrantSummary } from "@/lib/connections/grant-types";

const STATUS_LABEL: Record<ConnectionGrantSummary["status"], string> = {
  available: "Available · not checked",
  connected: "Connected",
  "not-connected": "Not connected",
  unavailable: "Unavailable",
  unknown: "Unable to verify",
};

export function GrantDetails({
  grant,
}: {
  readonly grant: ConnectionGrantSummary;
}) {
  const connected = grant.status === "connected";

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Status
          </dt>
          <dd className="text-sm">{STATUS_LABEL[grant.status]}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Account
          </dt>
          <dd className="text-sm">
            {connected
              ? (grant.accountLabel ??
                grant.github?.login ??
                grant.vercel?.username ??
                `Your ${grant.label} account`)
              : grant.status === "unavailable"
                ? "Not available on this deployment"
                : "None connected"}
          </dd>
        </div>
      </dl>

      {grant.detail ? (
        <p className="text-sm text-muted-foreground">{grant.detail}</p>
      ) : null}

      {(grant.requestedScopes.length > 0 ||
        (grant.grantedScopes && grant.grantedScopes.length > 0)) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {grant.requestedScopes.length > 0 ? (
            <ScopeList title="Requested" scopes={grant.requestedScopes} />
          ) : null}
          {grant.grantedScopes && grant.grantedScopes.length > 0 ? (
            <ScopeList title="Granted" scopes={grant.grantedScopes} />
          ) : null}
        </div>
      )}

      {grant.missingScopes && grant.missingScopes.length > 0 ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Missing: {grant.missingScopes.join(", ")}
        </p>
      ) : null}

      {grant.github ? <GithubGrantBlock github={grant.github} /> : null}
      {grant.vercel ? <VercelGrantBlock vercel={grant.vercel} /> : null}
    </div>
  );
}

function ScopeList({
  title,
  scopes,
}: {
  readonly title: string;
  readonly scopes: readonly string[];
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="mt-1 max-h-28 overflow-y-auto text-xs text-muted-foreground">
        {scopes.map((scope) => (
          <li key={scope} className="truncate font-mono">
            {scope}
          </li>
        ))}
      </ul>
    </div>
  );
}

function GithubGrantBlock({
  github,
}: {
  readonly github: NonNullable<ConnectionGrantSummary["github"]>;
}) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3 text-sm">
      <p className="font-medium">GitHub access</p>
      <p className="mt-1 text-muted-foreground">
        Signed in as <span className="text-foreground">{github.login}</span>
        {github.hasRepoScope ? " · repo scope granted" : " · missing repo scope"}
      </p>

      <div className="mt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Organizations
        </p>
        {github.orgs.length > 0 ? (
          <ul className="mt-1 space-y-1 text-muted-foreground">
            {github.orgs.map((org) => (
              <li key={org}>
                <span className="text-foreground">{org}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-muted-foreground">
            No organizations visible to this grant.
          </p>
        )}
      </div>

      <div className="mt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Repositories
        </p>
        {(github.availableRepos ?? []).length > 0 ? (
          <ul className="mt-1 max-h-64 space-y-2 overflow-y-auto">
            {(github.availableRepos ?? []).map((repo) => (
              <li key={repo.fullName}>
                <a
                  href={repo.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {repo.fullName}
                </a>
                <span className="ml-2 text-xs text-muted-foreground">
                  {repo.private ? "Private" : "Public"}
                </span>
                {repo.description ? (
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {repo.description}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-muted-foreground">
            No repositories visible to this grant yet.
          </p>
        )}
      </div>

      {github.repos.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Workbench pins
          </p>
          <ul className="mt-1 space-y-1">
            {github.repos.map((repo) => (
              <li key={repo.fullName} className="text-muted-foreground">
                <span className="text-foreground">{repo.fullName}</span>
                {repo.canPush
                  ? " · can push"
                  : ` · blocked${repo.blockedReason ? `: ${repo.blockedReason}` : ""}`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-2">
        <a
          href={github.manageUrl}
          target="_blank"
          rel="noreferrer"
          className="text-foreground underline-offset-2 hover:underline"
        >
          Authorized OAuth Apps
        </a>
      </p>
    </div>
  );
}

function VercelGrantBlock({
  vercel,
}: {
  readonly vercel: NonNullable<ConnectionGrantSummary["vercel"]>;
}) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3 text-sm">
      <p className="font-medium">Vercel access</p>
      <p className="mt-1 text-muted-foreground">
        Signed in as <span className="text-foreground">{vercel.username}</span>
      </p>
      {vercel.teams.length > 0 ? (
        <ul className="mt-2 space-y-1 text-muted-foreground">
          {vercel.teams.map((team) => (
            <li key={team.id}>
              {team.name}{" "}
              <span className="font-mono text-xs">({team.slug})</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-muted-foreground">
          Personal account (no teams on this grant).
        </p>
      )}
      <p className="mt-2 text-muted-foreground">
        Teams listed here are on this grant. Ask Pearl in chat to add another
        team — Update replaces the whole grant with one team.
      </p>
    </div>
  );
}
