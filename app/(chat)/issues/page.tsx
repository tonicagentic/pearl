import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import {
  ensureDefaultResponsibilities,
  flattenResponsibilityOptions,
  listOpenIssues,
  listRecentlyResolvedIssues,
  listResponsibilities,
} from "@/lib/db/issues";
import type { IssueWithResponsibility, ResponsibilityOption } from "@/lib/db/issues";
import { issueState, isDueSoon } from "@/lib/issues";
import { getSetupStatus } from "@/lib/setup";
import { getServerViewer } from "@/lib/session";

import { IssueRow } from "./issue-row";
import { NewIssueForm } from "./new-issue-form";

export const metadata: Metadata = {
  title: "Issues",
};

/**
 * The issues inbox: unresolved responsibilities, grouped by when they need
 * attention. Lifecycle beyond open/resolved is derived from the two dates
 * (docs/issues-responsibilities-plan.md). Static shell + Suspense for
 * cacheComponents, same as the artifacts page.
 */
export default function IssuesPage() {
  return (
    // Page frame: the shell's main is overflow-hidden (the chat scrolls
    // internally), so non-chat pages own their scroll here.
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="h-full overflow-y-auto px-4 pt-14 pb-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <Suspense fallback={<IssuesFallback />}>
            <ResolvedIssues />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function IssuesFallback() {
  return (
    <div className="rounded-lg border bg-card px-4 py-4 text-sm text-muted-foreground">
      Loading issues…
    </div>
  );
}

async function ResolvedIssues() {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer || setupStatus.storageMode !== "database") {
    return (
      <div className="flex flex-col gap-4">
        <IssuesCard message="Sign in with durable storage configured to track issues." />
        <p className="text-sm text-muted-foreground">
          Manage your areas of responsibility in{" "}
          <Link href="/settings/responsibilities" className="underline">
            Settings → Responsibilities
          </Link>
          .
        </p>
      </div>
    );
  }

  await ensureDefaultResponsibilities(viewer.id);

  const [openIssues, resolvedIssues, tree] = await Promise.all([
    listOpenIssues(viewer.id),
    listRecentlyResolvedIssues(
      viewer.id,
      new Date(Date.now() - 7 * 86_400_000).toISOString(),
    ),
    listResponsibilities(viewer.id),
  ]);

  const dueSoon: IssueWithResponsibility[] = [];
  const later: IssueWithResponsibility[] = [];
  const parked: IssueWithResponsibility[] = [];

  for (const row of openIssues) {
    if (isDueSoon(row)) {
      dueSoon.push(row);
    } else if (issueState(row) === "dormant") {
      parked.push(row);
    } else {
      later.push(row);
    }
  }

  const options: ResponsibilityOption[] = flattenResponsibilityOptions(tree);

  return (
    <>
      <header>
        <h1 className="text-lg font-semibold">Issues</h1>
        <p className="text-sm text-muted-foreground">
          Unresolved responsibilities that need your attention. Dormant items
          return on their review date — that is the contract.
        </p>
      </header>

      <IssueGroup
        title="Due soon"
        issues={dueSoon}
        options={options}
        empty="Nothing due soon."
      />
      <IssueGroup
        title="Later / no deadline"
        issues={later}
        options={options}
        empty="Nothing waiting."
      />

      {parked.length > 0 && (
        <details className="rounded-lg border bg-card">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-muted-foreground">
            Parked ({parked.length})
          </summary>
          <ul className="flex flex-col gap-2 border-t px-3 py-3">
            {parked.map((issue) => (
              <IssueRow key={issue.id} issue={issue} options={options} />
            ))}
          </ul>
        </details>
      )}

      {resolvedIssues.length > 0 && (
        <details className="rounded-lg border bg-card">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-muted-foreground">
            Resolved recently ({resolvedIssues.length})
          </summary>
          <ul className="flex flex-col gap-2 border-t px-3 py-3">
            {resolvedIssues.map((issue) => (
              <IssueRow key={issue.id} issue={issue} options={options} />
            ))}
          </ul>
        </details>
      )}

      <NewIssueForm options={options} />
    </>
  );
}

/** Sorted: overdue first, then by due date, undated last. */
function byDueDate(a: IssueWithResponsibility, b: IssueWithResponsibility) {
  return (a.dueDate ?? "9999-12-31") < (b.dueDate ?? "9999-12-31") ? -1 : 1;
}

function IssueGroup({
  title,
  issues,
  options,
  empty,
}: {
  readonly title: string;
  readonly issues: readonly IssueWithResponsibility[];
  readonly options: readonly { readonly id: string; readonly label: string }[];
  readonly empty: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      {issues.length === 0 ? (
        <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {[...issues].sort(byDueDate).map((issue) => (
            <IssueRow key={issue.id} issue={issue} options={options} />
          ))}
        </ul>
      )}
    </section>
  );
}

function IssuesCard({ message }: { readonly message: string }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-4 text-sm text-muted-foreground">
      {message}
    </div>
  );
}
