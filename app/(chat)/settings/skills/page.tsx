import type { Metadata } from "next";
import { Suspense } from "react";

import { listUserSkills } from "@/lib/db/skills";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

import { SkillsSettings } from "./skills-client";

export const metadata: Metadata = { title: "Skills" };

export default function SkillsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="h-full overflow-y-auto px-4 pt-14 pb-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <header>
            <h1 className="text-lg font-semibold">Skills</h1>
            <p className="text-sm text-muted-foreground">
              Procedures Pearl can load on demand for your account. The
              description is the routing hint; the body loads only when Pearl
              calls the skill. Changes apply on the next message.
            </p>
          </header>
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground">Loading skills…</p>
            }
          >
            <AuthenticatedSkills />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function AuthenticatedSkills() {
  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup);

  if (!viewer) {
    return (
      <p className="rounded-lg border bg-card p-4 text-sm">
        Sign in to manage your skills.
      </p>
    );
  }

  if (setup.storageMode !== "database") {
    return (
      <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Skills need database persistence.
      </p>
    );
  }

  const skills = await listUserSkills(viewer.id);
  return <SkillsSettings initialSkills={skills} />;
}
