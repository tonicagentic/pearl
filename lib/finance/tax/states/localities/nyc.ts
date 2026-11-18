import { money, toCents } from "@/lib/finance/agent-money";
import { applyBrackets } from "../../brackets";
import type { WorkpaperLine } from "../../types";
import { buildPaymentSummary, pushWp, wp } from "../helpers";
import type { StateComputeContext, StateComputeResult } from "../types";

/** NYC resident local income tax — gains taxed via ordinary NYC brackets. */
export function computeNyc(ctx: StateComputeContext): StateComputeResult {
  const limitations = [
    "NYC resident tax uses approximate brackets for planning; confirm against IT-201 / NYC instructions.",
    "NYC taxes capital gains through ordinary local brackets (no federal preferential rates).",
  ];
  const tables = ctx.tables.localities.NYC;
  // Approximate: NYC taxable starts from NY taxable ≈ federal TI − NY std ded (passed via federalTaxable as NY taxable)
  const taxable = money(Math.max(0, ctx.federalTaxableIncome));
  const incomeTax = money(applyBrackets(taxable, tables.brackets[ctx.status]));
  const totalTax = incomeTax;

  const workpapers: WorkpaperLine[] = [];
  pushWp(
    workpapers,
    wp("NYC", "IT-201 NYC", "NYC TI", "NYC taxable income", taxable, "local_taxable"),
  );
  pushWp(
    workpapers,
    wp("NYC", "IT-201 NYC", "NYC tax", "NYC resident tax", incomeTax, "local_tax"),
  );

  const pay = buildPaymentSummary({
    agi: ctx.federalAgi,
    taxableIncome: taxable,
    incomeTax,
    totalTax,
    priorYearTax: ctx.priorYearLocalTax,
    estimatedPayments: ctx.estimatedPaymentsLocal,
    withholding: ctx.withholdingLocal,
    safeHarborMultiplier: ctx.safeHarborMultiplier,
  });

  pushWp(
    workpapers,
    wp("NYC", "IT-201 NYC", "wh", "NYC withholding", ctx.withholdingLocal, "totals"),
  );
  pushWp(
    workpapers,
    wp("NYC", "IT-201 NYC", "owe", "NYC amount owed", pay.balanceDue, "totals"),
  );

  return {
    jurisdiction: "NYC",
    tax: totalTax,
    taxableIncome: taxable,
    incomeTax,
    workpapers,
    steps: [
      {
        id: "local_taxable",
        title: "NYC taxable income",
        localCents: toCents(taxable),
      },
      {
        id: "local_tax",
        title: "NYC resident tax",
        localCents: toCents(totalTax),
      },
    ],
    limitations,
    forms: ["IT-201 NYC"],
    summary: { ...pay.summary, id: "NYC" },
    local: null,
  };
}
