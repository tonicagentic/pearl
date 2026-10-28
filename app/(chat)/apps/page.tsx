import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { listAppsForUser } from "@/lib/apps/create-service";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export const metadata: Metadata = {
  title: "Apps",
};

export default function AppsPage() {
  return (
    <AppsPageFrame>
      <Suspense fallback={<AppsFallback />}>
        <ResolvedApps />
      </Suspense>
    </AppsPageFrame>
  );
}

async function ResolvedApps() {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer || setupStatus.storageMode !== "database") {
    return (
      <AppsCard message="Sign in with durable storage configured to see your mini apps." />
    );
  }

  await ensureUserForPrincipal({
    principalId: viewer.id,
    attributes: { name: viewer.name, email: viewer.email },
  });

  const apps = await listAppsForUser(viewer.id);

  return (
    <>
      <header>
        <h1 className="text-lg font-semibold">Apps</h1>
        <p className="text-sm text-muted-foreground">
          Mini apps Pearl built for you. Ask in chat to create or update one;
          published apps open here in an iframe.
        </p>
      </header>

      {apps.length === 0 ? (
        <div className="rounded-lg border bg-card px-3 py-4 text-sm text-muted-foreground">
          No mini apps yet. Ask Pearl to build one (for example, &ldquo;build me
          a tip calculator&rdquo;).
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {apps.map((app) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
              key={app.id}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{app.title}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {app.slug} · {app.status}
                  {app.productionUrl ? " · live" : ""}
                </div>
              </div>
              <Link
                className="rounded-md border px-2.5 py-1 text-sm hover:bg-accent"
                href={`/apps/${app.id}`}
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function AppsFallback() {
  return (
    <div className="rounded-lg border bg-card px-4 py-4 text-sm text-muted-foreground">
      Loading apps…
    </div>
  );
}

function AppsCard({ message }: { readonly message: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-base font-medium">Apps</div>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function AppsPageFrame({ children }: { readonly children: ReactNode }) {
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
