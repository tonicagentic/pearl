import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { embeddableProductionUrl } from "@/lib/apps/embed";
import { getMiniApp, toPublicMiniApp } from "@/lib/apps/queries";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export const metadata: Metadata = {
  title: "App",
};

export default function AppViewerPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  return (
    <AppViewerFrame>
      <Suspense fallback={<ViewerFallback />}>
        <ResolvedViewer params={params} />
      </Suspense>
    </AppViewerFrame>
  );
}

async function ResolvedViewer({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer || setupStatus.storageMode !== "database") {
    return (
      <ViewerCard message="Sign in with durable storage configured to open mini apps." />
    );
  }

  await ensureUserForPrincipal({
    principalId: viewer.id,
    attributes: { name: viewer.name, email: viewer.email },
  });

  const { id } = await params;
  const row = await getMiniApp(viewer.id, id);
  if (!row) {
    return <ViewerCard message="That app was not found on your account." />;
  }

  const app = toPublicMiniApp(row);
  const embedUrl = embeddableProductionUrl(app.productionUrl);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">{app.title}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {app.slug} · {app.status}
            {app.githubOwner ? ` · ${app.githubOwner}/${app.githubRepo}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            className="rounded-md border px-2.5 py-1 hover:bg-accent"
            href="/apps"
          >
            All apps
          </Link>
          {embedUrl ? (
            <a
              className="rounded-md border px-2.5 py-1 hover:bg-accent"
              href={embedUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              Open tab
            </a>
          ) : null}
        </div>
      </header>

      {embedUrl ? (
        <iframe
          className="min-h-0 w-full flex-1 rounded-lg border bg-background"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-forms allow-same-origin"
          src={embedUrl}
          title={app.title}
        />
      ) : (
        <div className="rounded-lg border bg-card px-3 py-4 text-sm text-muted-foreground">
          This app is not published yet. Ask Pearl to finish coding it and
          publish — then the live URL will open here.
        </div>
      )}
    </div>
  );
}

function ViewerFallback() {
  return (
    <div className="rounded-lg border bg-card px-4 py-4 text-sm text-muted-foreground">
      Loading app…
    </div>
  );
}

function ViewerCard({ message }: { readonly message: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-base font-medium">App</div>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function AppViewerFrame({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col px-4 pt-14 pb-4">
        <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}
