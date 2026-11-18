import { toCents, fromCents } from "@/lib/finance/agent-money";
import type { Bracket } from "./types";

/** Apply marginal brackets to income; returns tax in dollars (cent-rounded). */
export function applyBrackets(income: number, brackets: Bracket[]): number {
  const incomeCents = toCents(income);
  if (incomeCents <= 0) return 0;
  let taxCents = 0;
  let prevCents = 0;
  for (const b of brackets) {
    const topCents =
      b.upTo == null ? Number.POSITIVE_INFINITY : toCents(b.upTo);
    const slice = Math.min(incomeCents, topCents) - prevCents;
    if (slice > 0) {
      taxCents += Math.round(slice * b.rate);
    }
    prevCents = topCents;
    if (incomeCents <= topCents) break;
  }
  return fromCents(taxCents);
}

/**
 * Qualified Dividends and Capital Gain Tax Worksheet (simplified).
 * Ordinary taxable income taxed at ordinary rates; QD+LTCG stacked at pref rates
 * based on taxable income thresholds.
 */
export function taxWithPreferentialIncome(opts: {
  taxableIncome: number;
  qualifiedAndLtcg: number;
  ordinaryBrackets: Bracket[];
  ltcgBrackets: Bracket[];
}): { ordinaryTax: number; preferentialTax: number; totalTax: number } {
  const taxable = Math.max(0, opts.taxableIncome);
  const pref = Math.min(Math.max(0, opts.qualifiedAndLtcg), taxable);
  const ordinaryPortion = Math.max(0, taxable - pref);

  const ordinaryTax = applyBrackets(ordinaryPortion, opts.ordinaryBrackets);

  // Preferential tax: walk pref amount through LTCG brackets relative to taxable income stack
  // Tax on (ordinaryPortion + pref) at pref rates minus tax on ordinaryPortion at pref rates
  const taxAtPref = (amount: number) =>
    applyBrackets(amount, opts.ltcgBrackets);
  const preferentialTax = Math.max(
    0,
    taxAtPref(ordinaryPortion + pref) - taxAtPref(ordinaryPortion),
  );

  return {
    ordinaryTax,
    preferentialTax,
    totalTax: ordinaryTax + preferentialTax,
  };
}
