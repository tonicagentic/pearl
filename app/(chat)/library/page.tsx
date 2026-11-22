import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { list } from "@vercel/blob";
import { Loader2Icon } from "lucide-react";

import { artifactsPrefix } from "@/agent/lib/artifacts";
import { artifactKindFromBasename } from "@/lib/library/artifact-kind";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";
import {
  LibraryBrowser,
  type LibraryItem,
} from "./library-browser";

export const metadata: Metadata = {
  title: "Library",
};

/**
 * Library: durable, principal-scoped files and images the agent synced from
 * its workspace (docs: artifact-persistence-plan.md).
 */
export default function LibraryPage() {
  return (
    <LibraryPageFrame>
      <Suspense fallback={<LibraryFallback />}>
        <ResolvedLibrary />
      </Suspense>
    </LibraryPageFrame>
  );
}

async function ResolvedLibrary() {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer || setupStatus.storageMode !== "database") {
    return (
      <LibraryCard message="Sign in with durable storage configured to see your library." />
    );
  }

  const prefix = artifactsPrefix({
    principalId: viewer.id,
    principalType: "user",
  });

  if (!prefix) {
    return (
      <LibraryCard message="No library scope is available for this account." />
    );
  }

  let blobs: Awaited<ReturnType<typeof list>>["blobs"];

  try {
    ({ blobs } = await list({ prefix }));
  } catch {
    return (
      <LibraryCard message="The library store could not be reached. Try again later." />
    );
  }

  const items: LibraryItem[] = blobs.map((blob) => {
    const basename = blob.pathname.slice(prefix.length);
    return {
      pathname: blob.pathname,
      basename,
      size: blob.size,
      uploadedAt: blob.uploadedAt.toISOString(),
      kind: artifactKindFromBasename(basename),
    };
  });

  return (
    <>
      <header>
        <h1 className="text-lg font-semibold">Library</h1>
        <p className="text-sm text-muted-foreground">
          Files and images Pearl saved to durable storage. Search, preview, or
          delete them here.
        </p>
      </header>

      <LibraryBrowser initialItems={items} />
    </>
  );
}

function LibraryFallback() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
      Loading your library…
    </div>
  );
}

function LibraryCard({ message }: { readonly message: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-base font-medium">Library</div>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function LibraryPageFrame({ children }: { readonly children: ReactNode }) {
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
