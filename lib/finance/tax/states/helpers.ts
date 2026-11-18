import { moneyOf, toCents, money } from "@/lib/finance/agent-money";
import type { JurisdictionSummary, WorkpaperLine } from "../types";

export function emptySummary(
  agi: number,
  extras?: Partial<JurisdictionSummary>,
): JurisdictionSummary {
  const z = moneyOf(0);
  return {
    agi: moneyOf(agi),
    taxableIncome: z,
    incomeTax: z,
    totalTax: z,
    safeHarbor: z,
    paidEstimates: z,
    withholding: z,
    remaining: z,
    ...extras,
  };
}

export function buildPaymentSummary(opts: {
  agi: number;
  taxableIncome: number;
  incomeTax: number;
  totalTax: number;
  mentalHealthTax?: number;
  priorYearTax: number;
  estimatedPayments: number;
  withholding: number;
  safeHarborMultiplier: number;
}): {
  summary: JurisdictionSummary;
  remaining: number;
  balanceDue: number;
  refund: number;
  safe: number;
} {
  const safe = money(opts.priorYearTax * opts.safeHarborMultiplier);
  const paid = money(opts.estimatedPayments);
  const wh = money(opts.withholding);
  const target = money(Math.max(opts.totalTax, safe));
  const payments = money(paid + wh);
  const remaining = money(Math.max(0, target - payments));
  const balanceDue = money(Math.max(0, opts.totalTax - payments));
  const refund = money(Math.max(0, payments - opts.totalTax));
  return {
    safe,
    remaining,
    balanceDue,
    refund,
    summary: {
      agi: moneyOf(opts.agi),
      taxableIncome: moneyOf(opts.taxableIncome),
      incomeTax: moneyOf(opts.incomeTax),
      mentalHealthTax:
        opts.mentalHealthTax != null
          ? moneyOf(opts.mentalHealthTax)
          : undefined,
      totalTax: moneyOf(opts.totalTax),
      safeHarbor: moneyOf(safe),
      paidEstimates: moneyOf(paid),
      withholding: moneyOf(wh),
      remaining: moneyOf(remaining),
    },
  };
}

export function wp(
  jurisdiction: WorkpaperLine["jurisdiction"],
  form: string,
  line: string,
  label: string,
  amount: number,
  stepId: string,
): WorkpaperLine | null {
  const amountCents = toCents(amount);
  if (amountCents === 0) return null;
  return { jurisdiction, form, line, label, amountCents, stepId };
}

export function pushWp(
  list: WorkpaperLine[],
  line: WorkpaperLine | null,
) {
  if (line) list.push(line);
}
