import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { list } from "@vercel/blob";
import { Loader2Icon } from "lucide-react";

import { artifactsPrefix } from "@/agent/lib/artifacts";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";
import { DeleteArtifactButton } from "./delete-artifact-button";

export const metadata: Metadata = {
  title: "Artifacts",
};

/**
 * Stored artifacts: the durable, principal-scoped files the agent syncs from
 * its sandbox with save_artifact and restores at the start of every new
 * session (docs: artifact-persistence-plan.md). Server-rendered list; delete
 * is a client action with an explicit confirm, mirroring the agent's
 * approval-gated delete.
 */
export default function ArtifactsPage() {
  return (
    <ArtifactsPageFrame>
      <Suspense fallback={<ArtifactsFallback />}>
        <ResolvedArtifacts />
      </Suspense>
    </ArtifactsPageFrame>
  );
}

async function ResolvedArtifacts() {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer || setupStatus.storageMode !== "database") {
    return (
      <ArtifactsCard message="Sign in with durable storage configured to see your stored artifacts." />
    );
  }

  const prefix = artifactsPrefix({
    principalId: viewer.id,
    principalType: "user",
  });

  if (!prefix) {
    return (
      <ArtifactsCard message="No artifact scope is available for this account." />
    );
  }

  let blobs: Awaited<ReturnType<typeof list>>["blobs"];

  try {
    ({ blobs } = await list({ prefix }));
  } catch {
    return (
      <ArtifactsCard message="The artifact store could not be reached. Try again later." />
    );
  }

  return (
    <>
      <header>
        <h1 className="text-lg font-semibold">Artifacts</h1>
        <p className="text-sm text-muted-foreground">
          Files the agent synced from its workspace to durable storage. They are
          restored automatically at the start of every new session; preview,
          download, or delete them here.
        </p>
      </header>

      {blobs.length === 0 ? (
        <div className="rounded-lg border bg-card px-3 py-4 text-sm text-muted-foreground">
          No stored artifacts yet. Ask the agent to save a file
          (&ldquo;save this draft as an artifact&rdquo;) and it will show up
          here.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {blobs.map((blob) => {
            const basename = blob.pathname.slice(prefix.length);

            return (
              <li
                key={blob.pathname}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {basename}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatSize(blob.size)} · synced{" "}
                    {blob.uploadedAt.toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-sm">
                  <a
                    className="rounded-md border px-2.5 py-1 hover:bg-accent"
                    href={`/api/artifacts/content?pathname=${encodeURIComponent(blob.pathname)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open
                  </a>
                  <a
                    className="rounded-md border px-2.5 py-1 hover:bg-accent"
                    href={`/api/artifacts/content?pathname=${encodeURIComponent(blob.pathname)}&download=1`}
                  >
                    Download
                  </a>
                  <DeleteArtifactButton pathname={blob.pathname} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function formatSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function ArtifactsFallback() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
      Loading your artifacts…
    </div>
  );
}

function ArtifactsCard({ message }: { readonly message: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-base font-medium">Artifacts</div>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * Same frame contract as the profile page: fill `main`, own scroll, top
 * clearance for the absolutely positioned sidebar/menu controls.
 */
function ArtifactsPageFrame({ children }: { readonly children: ReactNode }) {
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
