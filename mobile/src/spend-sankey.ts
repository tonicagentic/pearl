import type { MonthSpendSummary } from "@/src/finances-client";

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

function moneyLabel(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
}

function txnHref(opts: {
  from: string;
  to: string;
  year: number;
  month: number;
  categoryId?: string | null;
  groupId?: string | null;
  groupName?: string | null;
}) {
  const p = new URLSearchParams();
  p.set("from", opts.from.slice(0, 10));
  p.set("to", opts.to.slice(0, 10));
  p.set("year", String(opts.year));
  p.set("month", String(opts.month));
  if (opts.categoryId) p.set("categoryId", opts.categoryId);
  if (opts.groupId) p.set("groupId", opts.groupId);
  if (opts.groupName) p.set("groupName", opts.groupName);
  return `/finances/transactions?${p.toString()}`;
}

export function buildSpendSankeyGraph(
  summary: MonthSpendSummary,
): SpendSankeyGraph {
  if (summary.totalSpent < 0.0001) {
    return {
      nodes: [],
      links: [],
      totalSpent: 0,
      totalSpentLabel: moneyLabel(0),
      label: summary.label,
    };
  }

  const from = summary.from;
  const to = summary.to;
  const nodes: SpendSankeyNode[] = [
    {
      id: SPENT_ID,
      label: "Spent",
      amount: summary.totalSpent,
      amountLabel: moneyLabel(summary.totalSpent),
      kind: "spent",
      href: txnHref({
        from,
        to,
        year: summary.year,
        month: summary.month,
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
      amountLabel: moneyLabel(g.amount),
      kind: "group",
      href: txnHref({
        from,
        to,
        year: summary.year,
        month: summary.month,
        groupId: g.groupId,
        groupName: g.groupId ? undefined : g.name,
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
      amountLabel: moneyLabel(c.amount),
      kind: "category",
      href: txnHref({
        from,
        to,
        year: summary.year,
        month: summary.month,
        categoryId: c.categoryId,
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
