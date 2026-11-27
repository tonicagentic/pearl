import type { Metadata } from "next";
import { Suspense } from "react";

import { IssueRow } from "@/app/(chat)/tasks/issue-row";
import { NewIssueForm } from "@/app/(chat)/tasks/new-issue-form";
import {
  FinancesCard,
  FinancesLoading,
} from "@/components/finances/finances-shell";
import {
  ensureDefaultAreas,
  flattenAreaOptions,
  listOpenIssues,
  listRecentlyResolvedIssues,
  listAreas,
  type AreaNode,
  type AreaOption,
  type IssueWithArea,
} from "@/lib/db/issues";
import { issueState, isDueSoon } from "@/lib/issues";
import { getSetupStatus } from "@/lib/setup";
import { getServerViewer } from "@/lib/session";

export const metadata: Metadata = {
  title: "Tasks · Finances",
};

const FINANCES_AREA_ROOT = "Finances";

function findAreaByNameInTree(
  nodes: readonly AreaNode[],
  name: string,
): AreaNode | null {
  for (const node of nodes) {
    if (node.name === name) return node;
    const nested = findAreaByNameInTree(node.children, name);
    if (nested) return nested;
  }
  return null;
}

function collectSubtreeIds(node: AreaNode): Set<string> {
  const ids = new Set<string>([node.id]);
  for (const child of node.children) {
    for (const id of collectSubtreeIds(child)) ids.add(id);
  }
  return ids;
}

/**
 * Finances → Tasks: Pearl issues whose area is Finances or a child
 * (Budget, Taxes, Investments).
 */
export default function FinancesTasksPage() {
  return (
    <Suspense fallback={<FinancesLoading label="Loading tasks…" />}>
      <ResolvedFinancesTasks />
    </Suspense>
  );
}

async function ResolvedFinancesTasks() {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer || setupStatus.storageMode !== "database") {
    return (
      <FinancesCard message="Sign in with durable storage configured to track finance tasks." />
    );
  }

  await ensureDefaultAreas(viewer.id);

  const [openIssues, resolvedIssues, tree] = await Promise.all([
    listOpenIssues(viewer.id),
    listRecentlyResolvedIssues(
      viewer.id,
      new Date(Date.now() - 7 * 86_400_000).toISOString(),
    ),
    listAreas(viewer.id),
  ]);

  const financesRoot = findAreaByNameInTree(tree, FINANCES_AREA_ROOT);
  const areaIds = financesRoot
    ? collectSubtreeIds(financesRoot)
    : new Set<string>();

  const inFinances = (row: IssueWithArea) => areaIds.has(row.areaId);
  const financeOpen = openIssues.filter(inFinances);
  const financeResolved = resolvedIssues.filter(inFinances);

  const dueSoon: IssueWithArea[] = [];
  const later: IssueWithArea[] = [];
  const parked: IssueWithArea[] = [];

  for (const row of financeOpen) {
    if (isDueSoon(row)) {
      dueSoon.push(row);
    } else if (issueState(row) === "dormant") {
      parked.push(row);
    } else {
      later.push(row);
    }
  }

  const allOptions: AreaOption[] = flattenAreaOptions(tree);
  const options = financesRoot
    ? flattenAreaOptions([financesRoot])
    : allOptions;
  const defaultAreaId = financesRoot?.id;

  return (
    <>
      <header>
        <h1 className="text-lg font-semibold">Tasks</h1>
        <p className="text-sm text-muted-foreground">
          Open loops filed under Finances — Budget, Taxes, and Investments.
        </p>
      </header>

      <TaskGroup
        title="Due soon"
        issues={dueSoon}
        options={allOptions}
        empty="Nothing due soon."
      />
      <TaskGroup
        title="Later / no deadline"
        issues={later}
        options={allOptions}
        empty="Nothing waiting."
      />

      {parked.length > 0 ? (
        <details className="rounded-lg border bg-card">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-muted-foreground">
            Parked ({parked.length})
          </summary>
          <ul className="flex flex-col gap-2 border-t px-3 py-3">
            {parked.map((issue) => (
              <IssueRow key={issue.id} issue={issue} options={allOptions} />
            ))}
          </ul>
        </details>
      ) : null}

      {financeResolved.length > 0 ? (
        <details className="rounded-lg border bg-card">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-muted-foreground">
            Resolved recently ({financeResolved.length})
          </summary>
          <ul className="flex flex-col gap-2 border-t px-3 py-3">
            {financeResolved.map((issue) => (
              <IssueRow key={issue.id} issue={issue} options={allOptions} />
            ))}
          </ul>
        </details>
      ) : null}

      <NewIssueForm options={options} defaultAreaId={defaultAreaId} />
    </>
  );
}

function byDueDate(a: IssueWithArea, b: IssueWithArea) {
  return (a.dueDate ?? "9999-12-31") < (b.dueDate ?? "9999-12-31") ? -1 : 1;
}

function TaskGroup({
  title,
  issues,
  options,
  empty,
}: {
  readonly title: string;
  readonly issues: readonly IssueWithArea[];
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
