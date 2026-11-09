import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import {
  listUserRepos,
  parsePageParam,
  type UserRepo,
} from "@/lib/repos/github-repos";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export const metadata: Metadata = {
  title: "Repos",
};

export default function ReposPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly page?: string | string[] }>;
}) {
  return (
    <ReposPageFrame>
      <Suspense fallback={<ReposFallback />}>
        <ResolvedRepos searchParams={searchParams} />
      </Suspense>
    </ReposPageFrame>
  );
}

async function ResolvedRepos({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly page?: string | string[] }>;
}) {
  const { page: rawPage } = await searchParams;
  const page = parsePageParam(Array.isArray(rawPage) ? rawPage[0] : rawPage);
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer) {
    return <ReposCard message="Sign in, then connect GitHub in Settings to see your repos." />;
  }

  let result: Awaited<ReturnType<typeof listUserRepos>>;
  try {
    result = await listUserRepos({ userId: viewer.id, page });
  } catch (cause) {
    return (
      <ReposCard
        message={cause instanceof Error ? cause.message : "Failed to load repos."}
      />
    );
  }

  if (!result.connected) {
    return (
      <ReposCard
        message={result.message}
        action={
          <Link className="text-sm underline" href="/settings">
            Open Settings
          </Link>
        }
      />
    );
  }

  return (
    <>
      <header>
        <h1 className="text-lg font-semibold">Repos</h1>
        <p className="text-sm text-muted-foreground">
          Your GitHub repositories, most recently pushed first.
        </p>
      </header>

      {result.repos.length === 0 ? (
        <div className="rounded-lg border bg-card px-3 py-4 text-sm text-muted-foreground">
          {page > 1 ? "No more repos." : "No repositories found on your GitHub account."}
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {result.repos.map((repo) => (
            <RepoRow key={repo.id} repo={repo} />
          ))}
        </ul>
      )}

      <nav className="flex items-center justify-between text-sm">
        {page > 1 ? (
          <Link className="rounded-md border px-2.5 py-1 hover:bg-accent" href={`/repos?page=${page - 1}`}>
            Previous
          </Link>
        ) : (
          <span />
        )}
        <span className="text-muted-foreground">Page {page}</span>
        {result.hasNext ? (
          <Link className="rounded-md border px-2.5 py-1 hover:bg-accent" href={`/repos?page=${page + 1}`}>
            Next
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </>
  );
}

function RepoRow({ repo }: { readonly repo: UserRepo }) {
  return (
    <li>
      <a
        className="flex flex-col gap-1 px-3 py-3 hover:bg-accent/50"
        href={repo.htmlUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        <div className="flex items-center gap-2">
          <span className="min-w-0 truncate text-sm font-medium">{repo.name}</span>
          <span className="shrink-0 rounded-full border px-1.5 text-xs text-muted-foreground">
            {repo.private ? "Private" : "Public"}
          </span>
        </div>
        {repo.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{repo.description}</p>
        ) : null}
        <span className="truncate text-xs text-muted-foreground">{repo.htmlUrl}</span>
      </a>
    </li>
  );
}

function ReposFallback() {
  return (
    <div className="rounded-lg border bg-card px-4 py-4 text-sm text-muted-foreground">
      Loading repos…
    </div>
  );
}

function ReposCard({
  message,
  action,
}: {
  readonly message: string;
  readonly action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-base font-medium">Repos</div>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

function ReposPageFrame({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="h-full overflow-y-auto px-4 pt-14 pb-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          {children}
        </div>
      </div>
    </div>
  );
}
