/** Canonical money helpers for Coach tools — never trust float display math. */

export type Money = {
  usd: number;
  cents: number;
};

export type ToolMoneyMeta = {
  source: string;
  asOf: string;
};

export function toCents(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromCents(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  return cents / 100;
}

/** Round an arbitrary number to canonical USD via integer cents. */
export function money(n: number): number {
  return fromCents(toCents(n));
}

export function moneyOf(n: number): Money {
  const cents = toCents(n);
  return { usd: fromCents(cents), cents };
}

export function toolPayload<T extends Record<string, unknown>>(
  source: string,
  data: T,
  asOf: Date = new Date(),
): T & ToolMoneyMeta {
  return {
    ...data,
    source,
    asOf: asOf.toISOString(),
  };
}

/** Map a record of raw numbers into Money envelopes. */
export function moneyFields<K extends string>(
  fields: Record<K, number>,
): Record<K, Money> {
  const out = {} as Record<K, Money>;
  for (const key of Object.keys(fields) as K[]) {
    out[key] = moneyOf(fields[key]);
  }
  return out;
}
