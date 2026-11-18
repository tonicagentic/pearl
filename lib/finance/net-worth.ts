import { prisma } from "./prisma";

export type EntitySnapshot = {
  id: string;
  name: string;
  slug: string;
  taxClass: string;
  assets: number;
  liabilities: number;
  equity: number;
  stakeFromYou: number;
  lookThroughEquity: number;
  taxableIncome: number;
  cashToYou: number;
  notes: string | null;
};

export type NetWorthHolding = {
  id: string;
  name: string;
  kind: "bank" | "brokerage" | "asset" | "liability";
  subtype: string;
  entityName: string;
  stakePercent: number;
  balance: number;
  lookThrough: number;
};

export type NetWorthComposition = {
  cash: number;
  investments: number;
  otherAssets: number;
  liabilities: number;
  totalAssets: number;
};

/**
 * Look-through net worth: your direct books + stake × child equity,
 * without double-counting intercompany investment assets.
 */
export async function computeNetWorth(asOfYear?: number) {
  const { syncAllOwnedAssets } = await import("@/lib/finance/owned-assets");
  await syncAllOwnedAssets();

  const year = asOfYear ?? new Date().getFullYear();
  const entities = await prisma.entity.findMany({
    include: {
      assets: true,
      liabilities: true,
      accounts: true,
      ownedStakes: true,
      heldStakes: true,
      taxActivities: { where: { year } },
    },
  });

  const you = entities.find((e) => e.taxClass === "individual" || e.slug === "you");
  if (!you) {
    return {
      netWorth: 0,
      snapshots: [] as EntitySnapshot[],
      youId: null as string | null,
      composition: {
        cash: 0,
        investments: 0,
        otherAssets: 0,
        liabilities: 0,
        totalAssets: 0,
      } satisfies NetWorthComposition,
      holdings: [] as NetWorthHolding[],
    };
  }
  const youId = you.id;

  function stakePercent(ownerId: string, ownedId: string): number {
    const stakes = entities.find((e) => e.id === ownerId)?.ownedStakes ?? [];
    const active = stakes.filter((s) => s.ownedEntityId === ownedId && !s.validTo);
    return active.reduce((s, x) => s + x.percent, 0);
  }

  function stakeFromYou(entityId: string): number {
    return entityId === youId ? 100 : stakePercent(youId, entityId);
  }

  const equityById = new Map<string, number>();
  for (const e of entities) {
    const accountAssets = e.accounts
      .filter((a) => a.type === "bank" || a.type === "brokerage")
      .reduce((s, a) => s + a.balance, 0);
    const accountLiabilities = e.accounts
      .filter((a) => a.type === "credit" || a.type === "loan")
      .reduce((s, a) => s + a.balance, 0);
    const manualAssets = e.assets.reduce((s, a) => s + a.value, 0);
    const manualLiabilities = e.liabilities.reduce((s, a) => s + a.balance, 0);
    const assets = accountAssets + manualAssets;
    const liabilities = accountLiabilities + manualLiabilities;
    equityById.set(e.id, assets - liabilities);
  }

  const snapshots: EntitySnapshot[] = entities.map((e) => {
    const equity = equityById.get(e.id) ?? 0;
    const assets =
      e.accounts
        .filter((a) => a.type === "bank" || a.type === "brokerage")
        .reduce((s, a) => s + a.balance, 0) + e.assets.reduce((s, a) => s + a.value, 0);
    const liabilities =
      e.accounts
        .filter((a) => a.type === "credit" || a.type === "loan")
        .reduce((s, a) => s + a.balance, 0) + e.liabilities.reduce((s, a) => s + a.balance, 0);

    const stake = stakeFromYou(e.id);
    const lookThroughEquity = e.id === you.id ? equity : equity * (stake / 100);

    const taxableIncome = e.taxActivities.reduce((s, a) => s + a.profit, 0);

    return {
      id: e.id,
      name: e.name,
      slug: e.slug,
      taxClass: e.taxClass,
      assets,
      liabilities,
      equity,
      stakeFromYou: stake,
      lookThroughEquity,
      taxableIncome,
      cashToYou: 0,
      notes: e.notes,
    };
  });

  // Cash to you: distributions/income into your personal accounts this year
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  const cashRows = await prisma.transaction.findMany({
    where: {
      entityId: you.id,
      date: { gte: yearStart, lt: yearEnd },
      type: { in: ["distribution", "income"] },
      amount: { gt: 0 },
    },
  });
  const cashToYou = cashRows.reduce((s, t) => s + t.amount, 0);
  for (const s of snapshots) {
    if (s.id === you.id) s.cashToYou = cashToYou;
  }

  const youSnap = snapshots.find((s) => s.id === you.id)!;
  const children = snapshots.filter((s) => s.id !== you.id && s.stakeFromYou > 0);
  const netWorth =
    youSnap.equity + children.reduce((s, c) => s + c.lookThroughEquity, 0);

  const holdings: NetWorthHolding[] = [];
  let cash = 0;
  let investments = 0;
  let otherAssets = 0;
  let liabilitiesLt = 0;

  for (const e of entities) {
    const stake = stakeFromYou(e.id);
    if (stake <= 0) continue;
    const weight = stake / 100;

    for (const a of e.accounts) {
      const lookThrough = a.balance * weight;
      if (a.type === "bank") {
        cash += lookThrough;
        holdings.push({
          id: a.id,
          name: a.name,
          kind: "bank",
          subtype: a.type,
          entityName: e.name,
          stakePercent: stake,
          balance: a.balance,
          lookThrough,
        });
      } else if (a.type === "brokerage") {
        investments += lookThrough;
        holdings.push({
          id: a.id,
          name: a.name,
          kind: "brokerage",
          subtype: a.type,
          entityName: e.name,
          stakePercent: stake,
          balance: a.balance,
          lookThrough,
        });
      } else if (a.type === "credit" || a.type === "loan") {
        liabilitiesLt += lookThrough;
        holdings.push({
          id: a.id,
          name: a.name,
          kind: "liability",
          subtype: a.type,
          entityName: e.name,
          stakePercent: stake,
          balance: a.balance,
          lookThrough,
        });
      }
    }

    for (const asset of e.assets) {
      // Skip assets that mirror a linked account balance to avoid double-counting display.
      if (asset.accountId) continue;
      const lookThrough = asset.value * weight;
      if (asset.type === "cash") {
        cash += lookThrough;
      } else if (asset.type === "investment") {
        investments += lookThrough;
      } else {
        otherAssets += lookThrough;
      }
      holdings.push({
        id: asset.id,
        name: asset.name,
        kind: "asset",
        subtype: asset.type,
        entityName: e.name,
        stakePercent: stake,
        balance: asset.value,
        lookThrough,
      });
    }

    for (const liab of e.liabilities) {
      if (liab.accountId) continue;
      const lookThrough = liab.balance * weight;
      liabilitiesLt += lookThrough;
      holdings.push({
        id: liab.id,
        name: liab.name,
        kind: "liability",
        subtype: liab.type,
        entityName: e.name,
        stakePercent: stake,
        balance: liab.balance,
        lookThrough,
      });
    }
  }

  holdings.sort((a, b) => b.lookThrough - a.lookThrough);

  const composition: NetWorthComposition = {
    cash,
    investments,
    otherAssets,
    liabilities: liabilitiesLt,
    totalAssets: cash + investments + otherAssets,
  };

  return { netWorth, snapshots, youId: you.id, composition, holdings };
}
