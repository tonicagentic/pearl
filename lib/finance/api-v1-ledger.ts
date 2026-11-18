import { format } from "date-fns";
import {
  compareByRenewalUrgency,
  DOCUMENT_KIND_LABELS,
  DOCUMENT_STATUS_LABELS,
  isDocumentKind,
  personalDocumentStatus,
  type DocumentKind,
} from "@/lib/finance/documents";
import { formatMoney } from "@/lib/finance/money";
import { computeNetWorth } from "@/lib/finance/net-worth";
import { prisma } from "@/lib/finance/prisma";
import { setTransactionsReconciled } from "@/lib/finance/reconcile-clear";
import { categoryMonthActuals } from "@/lib/finance/reports";
import {
  getRegisterFilterOptions,
  listTransactions,
  type TransactionListFilters,
} from "@/lib/finance/transactions";
import { buildTransactionsPayload } from "@/lib/finance/api-v1";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parseOptionalDate(raw: string | undefined): Date | undefined {
  if (!raw?.trim()) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

export function parseTransactionListFilters(
  searchParams: URLSearchParams,
): TransactionListFilters {
  const limit = Number(searchParams.get("limit") ?? "40");
  return {
    limit: Number.isFinite(limit) ? limit : 40,
    cursor: searchParams.get("cursor") ?? undefined,
    accountId: searchParams.get("accountId") ?? undefined,
    entityId: searchParams.get("entityId") ?? undefined,
    categoryId: searchParams.get("categoryId") ?? undefined,
    tripId: searchParams.get("tripId") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    inboxOnly: searchParams.get("inboxOnly") === "1" || searchParams.get("inboxOnly") === "true",
    from: parseOptionalDate(searchParams.get("from") ?? undefined),
    to: parseOptionalDate(searchParams.get("to") ?? undefined),
  };
}

export async function buildTransactionsListPayload(filters: TransactionListFilters) {
  const [payload, filterOptions] = await Promise.all([
    buildTransactionsPayload(filters),
    getRegisterFilterOptions(),
  ]);
  return {
    ...payload,
    filterOptions: {
      accounts: filterOptions.accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        entityId: a.entityId,
        entityName: a.entity.name,
      })),
      entities: filterOptions.entities,
      categories: filterOptions.categories.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        slug: c.slug,
        groupName: c.group.name,
        groupKind: c.group.kind,
      })),
    },
  };
}

export type CreateTransactionInput = {
  accountId: string;
  amount: number;
  type: string;
  date: string;
  memo?: string | null;
  categoryId?: string | null;
  billId?: string | null;
  tripId?: string | null;
};

export async function createManualTransaction(input: CreateTransactionInput) {
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: input.accountId },
  });
  const type = input.type.trim();
  if (!type) throw new Error("type is required");

  const amount = Number(input.amount);
  if (!Number.isFinite(amount)) throw new Error("amount is required");

  const signed =
    type === "income" || type === "distribution" || type === "contribution"
      ? Math.abs(amount)
      : type === "transfer"
        ? amount
        : -Math.abs(amount);

  const date = new Date(input.date);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");

  const txn = await prisma.transaction.create({
    data: {
      accountId: input.accountId,
      entityId: account.entityId,
      date,
      amount: signed,
      type,
      memo: input.memo?.trim() || null,
      categoryId: input.categoryId?.trim() || null,
      billId: input.billId?.trim() || null,
      tripId: input.tripId?.trim() || null,
    },
  });

  await prisma.account.update({
    where: { id: input.accountId },
    data: { balance: account.balance + signed, balanceAsOf: new Date() },
  });

  return { id: txn.id };
}

export type PatchTransactionInput = {
  categoryId?: string | null;
  type?: string;
  billId?: string | null;
  tripId?: string | null;
  reconcile?: boolean;
};

export async function patchTransaction(id: string, input: PatchTransactionInput) {
  const categoryId =
    input.categoryId === undefined ? undefined : input.categoryId?.trim() || null;

  const updated = await prisma.transaction.update({
    where: { id },
    data: {
      ...(input.type?.trim() ? { type: input.type.trim() } : {}),
      ...(input.billId !== undefined ? { billId: input.billId?.trim() || null } : {}),
      ...(input.tripId !== undefined ? { tripId: input.tripId?.trim() || null } : {}),
      ...(categoryId !== undefined ? { categoryId } : {}),
      ...(input.reconcile === true
        ? { reconciledAt: new Date() }
        : input.reconcile === false
          ? { reconciledAt: null }
          : {}),
    },
    select: { id: true, accountId: true },
  });

  return updated;
}

export async function buildUnclearedTransactionsPayload(accountId: string) {
  const rows = await listTransactions({
    accountId,
    limit: 100,
  });
  const uncleared = await prisma.transaction.findMany({
    where: {
      accountId,
      reconciledAt: null,
      pending: false,
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: 100,
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  });

  return {
    accountId,
    items: uncleared.map((t) => ({
      id: t.id,
      date: t.date.toISOString(),
      memo: t.memo,
      amount: t.amount,
      amountLabel: formatMoney(t.amount, { signed: true }),
      type: t.type,
      category: t.category
        ? { id: t.category.id, name: t.category.name, slug: t.category.slug }
        : null,
    })),
    recent: rows.items.slice(0, 20).map((t) => ({
      id: t.id,
      date: t.date.toISOString(),
      memo: t.memo,
      amountLabel: formatMoney(t.amount, { signed: true }),
    })),
  };
}

export async function reconcileAccountTransactions(
  accountId: string,
  transactionIds: string[],
  reconciled: boolean,
) {
  const owned = await prisma.transaction.findMany({
    where: { id: { in: transactionIds }, accountId },
    select: { id: true },
  });
  const ids = owned.map((t) => t.id);
  const result = await setTransactionsReconciled(ids, reconciled, {
    requireCategorized: reconciled,
  });
  return { accountId, ...result };
}

export async function buildCategoriesPayload() {
  const { year, month } = (() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  })();

  const [groups, monthActuals, groupOptions] = await Promise.all([
    prisma.categoryGroup.findMany({
      where: { kind: { in: ["lifestyle", "cash_only"] } },
      orderBy: { sortOrder: "asc" },
      include: {
        categories: {
          where: { isArchived: false },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    categoryMonthActuals(year, month),
    prisma.categoryGroup.findMany({
      where: { kind: { in: ["lifestyle", "cash_only"] } },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, kind: true, slug: true },
    }),
  ]);

  // categoryMonthActuals already returns Map<categoryId, amount>
  const actualByCategory = monthActuals;

  return {
    period: { year, month },
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      kind: g.kind,
      slug: g.slug,
      categories: g.categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        code: c.code,
        sortOrder: c.sortOrder,
        monthActual: actualByCategory.get(c.id) ?? 0,
        monthActualLabel: formatMoney(actualByCategory.get(c.id) ?? 0),
      })),
    })),
    groupOptions,
  };
}

export type CreateCategoryInput = {
  name: string;
  groupId: string;
  slug?: string;
};

export async function createCategoryRecord(input: CreateCategoryInput) {
  const name = input.name.trim();
  const groupId = input.groupId.trim();
  if (!name || !groupId) throw new Error("name and groupId are required");
  const slug = input.slug?.trim() || slugify(name);

  const category = await prisma.category.create({
    data: { name, slug, groupId, sortOrder: 99 },
    select: { id: true },
  });
  return category;
}

export type PatchCategoryInput = {
  name?: string;
  isArchived?: boolean;
};

export async function patchCategoryRecord(id: string, input: PatchCategoryInput) {
  const data: { name?: string; isArchived?: boolean } = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("name cannot be empty");
    data.name = name;
  }
  if (input.isArchived !== undefined) data.isArchived = input.isArchived;

  await prisma.category.update({ where: { id }, data });
  return { id };
}

export async function buildEntitiesPayload() {
  const [{ snapshots, youId }, entities] = await Promise.all([
    computeNetWorth(),
    prisma.entity.findMany({
      orderBy: { name: "asc" },
      include: {
        heldStakes: {
          where: { validTo: null },
          include: { ownerEntity: { select: { name: true } } },
        },
      },
    }),
  ]);

  const snapshotById = new Map(snapshots.map((s) => [s.id, s]));

  return {
    youId,
    entities: entities.map((e) => {
      const snap = snapshotById.get(e.id);
      return {
        id: e.id,
        name: e.name,
        slug: e.slug,
        taxClass: e.taxClass,
        notes: e.notes,
        equity: snap?.equity ?? null,
        equityLabel: snap ? formatMoney(snap.equity) : null,
        lookThroughEquity: snap?.lookThroughEquity ?? null,
        lookThroughEquityLabel: snap ? formatMoney(snap.lookThroughEquity) : null,
        owners: e.heldStakes.map((s) => ({
          ownerEntityId: s.ownerEntityId,
          ownerName: s.ownerEntity.name,
          percent: s.percent,
        })),
      };
    }),
  };
}

export type CreateEntityInput = {
  name: string;
  taxClass: string;
  slug?: string;
  notes?: string | null;
  ownerId?: string | null;
  percent?: number;
};

export async function createEntityRecord(input: CreateEntityInput) {
  const name = input.name.trim();
  if (!name) throw new Error("name is required");
  const taxClass = input.taxClass.trim();
  if (!taxClass) throw new Error("taxClass is required");

  const slug = input.slug?.trim() || slugify(name);
  const percent = input.percent ?? 100;

  const entity = await prisma.entity.create({
    data: {
      name,
      slug,
      taxClass,
      notes: input.notes?.trim() || null,
    },
    select: { id: true },
  });

  const ownerId = input.ownerId?.trim();
  if (ownerId) {
    await prisma.stake.create({
      data: {
        ownerEntityId: ownerId,
        ownedEntityId: entity.id,
        percent,
      },
    });
  }

  return entity;
}

export type PatchEntityInput = {
  name?: string;
  taxClass?: string;
  slug?: string;
  notes?: string | null;
};

export async function patchEntityRecord(id: string, input: PatchEntityInput) {
  const data: {
    name?: string;
    taxClass?: string;
    slug?: string;
    notes?: string | null;
  } = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("name cannot be empty");
    data.name = name;
  }
  if (input.taxClass !== undefined) {
    const taxClass = input.taxClass.trim();
    if (!taxClass) throw new Error("taxClass cannot be empty");
    data.taxClass = taxClass;
  }
  if (input.slug !== undefined) data.slug = input.slug.trim() || slugify(data.name ?? "");
  if (input.notes !== undefined) data.notes = input.notes?.trim() || null;

  await prisma.entity.update({ where: { id }, data });
  return { id };
}

export async function buildBillsPayload() {
  const [bills, categories] = await Promise.all([
    prisma.bill.findMany({
      where: { isActive: true },
      include: { category: { include: { group: true } } },
      orderBy: [{ nextDate: "asc" }, { name: "asc" }],
    }),
    prisma.category.findMany({
      where: { isArchived: false, group: { kind: "lifestyle" } },
      include: { group: true },
      orderBy: [{ group: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    }),
  ]);

  return {
    bills: bills.map((b) => ({
      id: b.id,
      name: b.name,
      amount: b.amount,
      amountLabel: formatMoney(b.amount),
      cadence: b.cadence,
      notes: b.notes,
      nextDate: b.nextDate?.toISOString() ?? null,
      nextDateLabel: b.nextDate ? format(b.nextDate, "MMM d, yyyy") : null,
      isActive: b.isActive,
      category: {
        id: b.category.id,
        name: b.category.name,
        groupName: b.category.group.name,
      },
    })),
    categoryOptions: categories.map((c) => ({
      id: c.id,
      label: `${c.group.name} · ${c.name}`,
    })),
  };
}

export type CreateBillInput = {
  name: string;
  categoryId: string;
  amount: number;
  cadence?: string;
  notes?: string | null;
  nextDate?: string | null;
};

export async function createBillRecord(input: CreateBillInput) {
  const name = input.name.trim();
  const categoryId = input.categoryId.trim();
  if (!name || !categoryId) throw new Error("name and categoryId are required");

  const amount = Number(input.amount);
  if (!Number.isFinite(amount)) throw new Error("amount is required");

  const bill = await prisma.bill.create({
    data: {
      name,
      categoryId,
      amount,
      cadence: input.cadence?.trim() || "monthly",
      notes: input.notes?.trim() || null,
      nextDate: input.nextDate ? new Date(input.nextDate) : null,
    },
    select: { id: true },
  });
  return bill;
}

export type PatchBillInput = {
  name?: string;
  categoryId?: string;
  amount?: number;
  cadence?: string;
  notes?: string | null;
  nextDate?: string | null;
  isActive?: boolean;
};

export async function patchBillRecord(id: string, input: PatchBillInput) {
  const data: {
    name?: string;
    categoryId?: string;
    amount?: number;
    cadence?: string;
    notes?: string | null;
    nextDate?: Date | null;
    isActive?: boolean;
  } = {};

  if (input.name !== undefined) data.name = input.name.trim();
  if (input.categoryId !== undefined) data.categoryId = input.categoryId.trim();
  if (input.amount !== undefined) data.amount = Number(input.amount);
  if (input.cadence !== undefined) data.cadence = input.cadence.trim() || "monthly";
  if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
  if (input.nextDate !== undefined) {
    data.nextDate = input.nextDate ? new Date(input.nextDate) : null;
  }
  if (input.isActive !== undefined) data.isActive = input.isActive;

  await prisma.bill.update({ where: { id }, data });
  return { id };
}

export async function buildPersonalDocumentsPayload() {
  const now = new Date();
  const rawDocs = await prisma.personalDocument.findMany({
    orderBy: [{ renewsOn: "asc" }, { name: "asc" }],
  });

  const withStatus = rawDocs.map((d) => ({
    ...d,
    status: personalDocumentStatus(d.kind, d.renewsOn, now),
  }));
  withStatus.sort(compareByRenewalUrgency);

  const documents = withStatus.map((d) => {
    const kind = isDocumentKind(d.kind) ? d.kind : ("other" as DocumentKind);
    return {
      id: d.id,
      name: d.name,
      kind: d.kind,
      kindLabel: DOCUMENT_KIND_LABELS[kind],
      holder: d.holder,
      issuer: d.issuer,
      identifier: d.identifier,
      issuedOn: d.issuedOn?.toISOString() ?? null,
      renewsOn: d.renewsOn?.toISOString() ?? null,
      renewsOnLabel: d.renewsOn ? format(d.renewsOn, "MMM d, yyyy") : null,
      notes: d.notes,
      status: d.status,
      statusLabel: DOCUMENT_STATUS_LABELS[d.status],
    };
  });

  const counts = {
    overdue: documents.filter((d) => d.status === "overdue").length,
    dueSoon: documents.filter((d) => d.status === "due_soon").length,
    current: documents.filter((d) => d.status === "current").length,
    noDate: documents.filter((d) => d.status === "no_date").length,
  };

  return { documents, counts };
}

export type CreatePersonalDocumentInput = {
  name: string;
  kind?: string;
  holder?: string | null;
  issuer?: string | null;
  identifier?: string | null;
  issuedOn?: string | null;
  renewsOn?: string | null;
  notes?: string | null;
};

function dateOnlyFromIso(raw: string | null | undefined): Date | null {
  if (!raw?.trim()) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    return new Date(y, mo - 1, d, 12, 0, 0, 0);
  }
  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export async function createPersonalDocumentRecord(input: CreatePersonalDocumentInput) {
  const name = input.name.trim();
  if (!name) throw new Error("name is required");
  const kindRaw = input.kind?.trim() || "other";
  const kind = isDocumentKind(kindRaw) ? kindRaw : "other";

  const doc = await prisma.personalDocument.create({
    data: {
      name,
      kind,
      holder: input.holder?.trim() || null,
      issuer: input.issuer?.trim() || null,
      identifier: input.identifier?.trim() || null,
      issuedOn: dateOnlyFromIso(input.issuedOn),
      renewsOn: dateOnlyFromIso(input.renewsOn),
      notes: input.notes?.trim() || null,
    },
    select: { id: true },
  });
  return doc;
}

export type PatchPersonalDocumentInput = Partial<CreatePersonalDocumentInput>;

export async function patchPersonalDocumentRecord(
  id: string,
  input: PatchPersonalDocumentInput,
) {
  const data: {
    name?: string;
    kind?: string;
    holder?: string | null;
    issuer?: string | null;
    identifier?: string | null;
    issuedOn?: Date | null;
    renewsOn?: Date | null;
    notes?: string | null;
  } = {};

  if (input.name !== undefined) data.name = input.name.trim();
  if (input.kind !== undefined) {
    const kindRaw = input.kind.trim() || "other";
    data.kind = isDocumentKind(kindRaw) ? kindRaw : "other";
  }
  if (input.holder !== undefined) data.holder = input.holder?.trim() || null;
  if (input.issuer !== undefined) data.issuer = input.issuer?.trim() || null;
  if (input.identifier !== undefined) data.identifier = input.identifier?.trim() || null;
  if (input.issuedOn !== undefined) data.issuedOn = dateOnlyFromIso(input.issuedOn);
  if (input.renewsOn !== undefined) data.renewsOn = dateOnlyFromIso(input.renewsOn);
  if (input.notes !== undefined) data.notes = input.notes?.trim() || null;

  await prisma.personalDocument.update({ where: { id }, data });
  return { id };
}