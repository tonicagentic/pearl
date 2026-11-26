import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { list } from "@vercel/blob";
import { Loader2Icon } from "lucide-react";

import { artifactsPrefix } from "@/agent/lib/artifacts";
import { listLibraryQuotes } from "@/lib/db/library-quotes";
import { artifactKindFromBasename } from "@/lib/library/artifact-kind";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";
import {
  LibraryBrowser,
  type LibraryItem,
  type LibraryQuoteItem,
} from "./library-browser";

export const metadata: Metadata = {
  title: "Library",
};

/**
 * Library: durable files/images plus Quotes saved from chat selections.
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

  let items: LibraryItem[] = [];
  let artifactsError: string | null = null;

  try {
    const { blobs } = await list({ prefix });
    items = blobs.map((blob) => {
      const basename = blob.pathname.slice(prefix.length);
      return {
        pathname: blob.pathname,
        basename,
        size: blob.size,
        uploadedAt: blob.uploadedAt.toISOString(),
        kind: artifactKindFromBasename(basename),
      };
    });
  } catch {
    artifactsError =
      "Files and images could not be loaded. Quotes below may still be available.";
  }

  let quotes: LibraryQuoteItem[] = [];
  let quotesError: string | null = null;

  try {
    quotes = [...(await listLibraryQuotes(viewer.id))];
  } catch {
    quotesError =
      "Quotes could not be loaded. Files and images above may still be available.";
  }

  return (
    <>
      <header>
        <h1 className="text-lg font-semibold">Library</h1>
        <p className="text-sm text-muted-foreground">
          Files and images Pearl saved to durable storage, plus quotes you
          highlight from chat replies.
        </p>
      </header>

      <LibraryBrowser
        initialItems={items}
        initialQuotes={quotes}
        artifactsError={artifactsError}
        quotesError={quotesError}
      />
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
