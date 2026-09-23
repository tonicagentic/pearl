import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { Loader2Icon } from "lucide-react";

import { MarkdownContent } from "@/components/assistant-ui/elements/markdown-content";
import { readProfileMemory } from "@/lib/memory/profile-document";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export const metadata: Metadata = {
  title: "Profile",
};

/**
 * Shows the agent's memory document for the signed-in principal — the same
 * MEMORY.md eve's file memory recalls before every turn. Static shell with
 * the reader inside Suspense, same contract as the usage page.
 */
export default function ProfilePage() {
  return (
    <ProfilePageFrame>
      <Suspense fallback={<ProfileFallback />}>
        <ResolvedProfile />
      </Suspense>
    </ProfilePageFrame>
  );
}

async function ResolvedProfile() {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer || setupStatus.authMode === "local-dev") {
    return (
      <ProfileCard
        title="Profile"
        message="Sign in to see what your agent remembers about you."
      />
    );
  }

  const result = await readProfileMemory(setupStatus.authMode, viewer.id);

  if (result.state === "unavailable") {
    return (
      <ProfileCard
        title="Profile"
        message={
          result.reason === "no-storage"
            ? "Agent memory needs durable storage to be configured."
            : "The memory store could not be reached. Try again later."
        }
      />
    );
  }

  return (
    <>
      <header>
        <h1 className="text-lg font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          What your agent remembers about you. It reads this before every
          conversation; ask it to remember or forget something to change this
          page. Stored files live on the{" "}
          <a className="underline" href="/artifacts">
            Artifacts
          </a>{" "}
          page.
        </p>
      </header>

      {result.state === "ok" ? (
        <div className="rounded-lg border bg-card px-4 py-2">
          <MarkdownContent text={result.content} className="text-sm" />
        </div>
      ) : (
        <div className="rounded-lg border bg-card px-3 py-4 text-sm text-muted-foreground">
          {result.reason === "no-matching-document"
            ? "No memory saved for this account yet. Ask the agent to remember something and it will show up here."
            : "No memories yet. Ask the agent to remember a preference and it will show up here."}
        </div>
      )}
    </>
  );
}

function ProfileFallback() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
      Loading your profile…
    </div>
  );
}

/**
 * Same frame contract as the usage page: fill `main`, own scroll, top
 * clearance for the absolutely positioned sidebar/menu controls.
 */
function ProfilePageFrame({ children }: { readonly children: ReactNode }) {
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

function ProfileCard({
  title,
  message,
}: {
  readonly title: string;
  readonly message: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-base font-medium">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
