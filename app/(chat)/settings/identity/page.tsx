import type { Metadata } from "next";
import { Suspense } from "react";

import { getUserProfile } from "@/lib/db/profile";
import { toProfileDto } from "@/lib/profile/serialize";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

import { IdentitySettings } from "./identity-client";

export const metadata: Metadata = { title: "Identity" };

export default function IdentityPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="h-full overflow-y-auto px-4 pt-14 pb-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <header>
            <h1 className="text-lg font-semibold">Identity</h1>
            <p className="text-sm text-muted-foreground">
              Structured facts about you — name, body, health notes, and home.
              Pearl loads them on demand for fit and health context, not on
              every turn. Free-form memories stay in Profile.
            </p>
          </header>
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground">Loading identity…</p>
            }
          >
            <AuthenticatedIdentity />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function AuthenticatedIdentity() {
  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup);

  if (!viewer) {
    return (
      <p className="rounded-lg border bg-card p-4 text-sm">
        Sign in to edit your identity profile.
      </p>
    );
  }

  if (setup.storageMode !== "database") {
    return (
      <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Identity needs database persistence.
      </p>
    );
  }

  const profile = toProfileDto(await getUserProfile(viewer.id));
  return <IdentitySettings initialProfile={profile} />;
}
