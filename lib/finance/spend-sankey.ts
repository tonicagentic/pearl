import { formatMoney } from "@/lib/finance/money";
import type { MonthSpendSummary } from "@/lib/finance/spend-summary";
import { financesTransactionsHref } from "@/lib/finance/report-period";

export type SpendSankeyNodeKind = "spent" | "group" | "category";

export type SpendSankeyNode = {
  id: string;
  label: string;
  amount: number;
  amountLabel: string;
  kind: SpendSankeyNodeKind;
  href: string | null;
};

export type SpendSankeyLink = {
  source: string;
  target: string;
  value: number;
};

export type SpendSankeyGraph = {
  nodes: SpendSankeyNode[];
  links: SpendSankeyLink[];
  totalSpent: number;
  totalSpentLabel: string;
  label: string;
};

const SPENT_ID = "spent";

export function buildSpendSankeyGraph(
  summary: MonthSpendSummary,
  opts?: { readonly transactionsBasePath?: string },
): SpendSankeyGraph {
  const from = new Date(summary.from);
  const to = new Date(summary.to);
  const basePath = opts?.transactionsBasePath;

  if (summary.totalSpent < 0.0001) {
    return {
      nodes: [],
      links: [],
      totalSpent: 0,
      totalSpentLabel: formatMoney(0),
      label: summary.label,
    };
  }

  const nodes: SpendSankeyNode[] = [
    {
      id: SPENT_ID,
      label: "Spent",
      amount: summary.totalSpent,
      amountLabel: formatMoney(summary.totalSpent),
      kind: "spent",
      href: financesTransactionsHref({
        from,
        to,
        year: summary.year,
        month: summary.month,
        basePath,
      }),
    },
  ];

  const links: SpendSankeyLink[] = [];
  const groupIdByKey = new Map<string, string>();

  for (const g of summary.groups) {
    if (g.amount < 0.0001) continue;
    const id = g.groupId ? `group:${g.groupId}` : `group-name:${g.name}`;
    groupIdByKey.set(g.groupId ?? `name:${g.name}`, id);
    nodes.push({
      id,
      label: g.name,
      amount: g.amount,
      amountLabel: formatMoney(g.amount),
      kind: "group",
      href: financesTransactionsHref({
        from,
        to,
        year: summary.year,
        month: summary.month,
        groupId: g.groupId ?? undefined,
        groupName: g.groupId ? undefined : g.name,
        basePath,
      }),
    });
    links.push({ source: SPENT_ID, target: id, value: g.amount });
  }

  for (const c of summary.categories) {
    if (c.amount < 0.0001) continue;
    const groupKey = c.groupId ?? `name:${c.groupName}`;
    const groupNodeId = groupIdByKey.get(groupKey);
    if (!groupNodeId) continue;

    const id = c.categoryId
      ? `category:${c.categoryId}`
      : `category-uncat:${c.name}`;
    nodes.push({
      id,
      label: c.name,
      amount: c.amount,
      amountLabel: formatMoney(c.amount),
      kind: "category",
      href: financesTransactionsHref({
        from,
        to,
        year: summary.year,
        month: summary.month,
        categoryId: c.categoryId,
        basePath,
      }),
    });
    links.push({ source: groupNodeId, target: id, value: c.amount });
  }

  return {
    nodes,
    links,
    totalSpent: summary.totalSpent,
    totalSpentLabel: summary.totalSpentLabel,
    label: summary.label,
  };
}
