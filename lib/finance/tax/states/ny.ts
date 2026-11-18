import { money, toCents } from "@/lib/finance/agent-money";
import { applyBrackets } from "../brackets";
import type { WorkpaperLine } from "../types";
import { buildPaymentSummary, pushWp, wp } from "./helpers";
import { computeNyc } from "./localities/nyc";
import type { StateComputeContext, StateComputeResult, StateTaxModule } from "./types";

/**
 * New York State resident tax. When residentLocality is NYC, also runs NYC local.
 * Gains flow through ordinary NY/NYC brackets (no federal preferential CG).
 */
export const nyModule: StateTaxModule = {
  id: "NY",
  label: "New York",
  compute(ctx: StateComputeContext): StateComputeResult {
    const limitations: string[] = [
      "NY starts from federal AGI with simplified standard deduction; full IT-201 additions/subtractions not modeled.",
      "New York taxes capital gains as ordinary state income (no federal preferential CG rates).",
    ];

    const tables = ctx.tables.states.NY;
    const stdDed = tables.standardDeduction[ctx.status];
    const taxable = money(Math.max(0, ctx.federalAgi - stdDed));
    const incomeTax = money(applyBrackets(taxable, tables.brackets[ctx.status]));
    const totalTax = incomeTax;

    const workpapers: WorkpaperLine[] = [];
    pushWp(
      workpapers,
      wp("NY", "IT-201", "1", "Federal AGI", ctx.federalAgi, "state_taxable"),
    );
    pushWp(
      workpapers,
      wp("NY", "IT-201", "std", "NY standard deduction", stdDed, "state_taxable"),
    );
    pushWp(
      workpapers,
      wp("NY", "IT-201", "TI", "New York taxable income", taxable, "state_taxable"),
    );
    pushWp(
      workpapers,
      wp("NY", "IT-201", "tax", "New York State tax", incomeTax, "state_tax"),
    );

    const pay = buildPaymentSummary({
      agi: ctx.federalAgi,
      taxableIncome: taxable,
      incomeTax,
      totalTax,
      priorYearTax: ctx.priorYearStateTax,
      estimatedPayments: ctx.estimatedPaymentsState,
      withholding: ctx.withholdingState,
      safeHarborMultiplier: ctx.safeHarborMultiplier,
    });

    pushWp(
      workpapers,
      wp("NY", "IT-201", "wh", "NY withholding", ctx.withholdingState, "totals"),
    );
    pushWp(
      workpapers,
      wp(
        "NY",
        "IT-201",
        "est",
        "Estimated tax payments",
        ctx.estimatedPaymentsState,
        "totals",
      ),
    );
    pushWp(
      workpapers,
      wp("NY", "IT-201", "owe", "Amount you owe", pay.balanceDue, "totals"),
    );

    let local: StateComputeResult | null = null;
    if (ctx.residentLocality === "NYC") {
      local = computeNyc({
        ...ctx,
        // Pass NY taxable as base for NYC brackets (simplified)
        federalTaxableIncome: taxable,
      });
      limitations.push(...local.limitations);
    } else if (ctx.residentLocality) {
      limitations.push(
        `Locality ${ctx.residentLocality} is not a modeled NY local income tax (only NYC is).`,
      );
    }

    return {
      jurisdiction: "NY",
      tax: totalTax,
      taxableIncome: taxable,
      incomeTax,
      workpapers,
      steps: [
        {
          id: "state_taxable",
          title: "New York taxable income",
          stateCents: toCents(taxable),
          details: [
            { label: "NY standard deduction", amountCents: toCents(stdDed) },
          ],
        },
        {
          id: "state_tax",
          title: "New York State tax",
          stateCents: toCents(totalTax),
        },
        ...(local?.steps ?? []),
      ],
      limitations,
      forms: ["IT-201", ...(local?.forms ?? [])],
      summary: { ...pay.summary, id: "NY" },
      local,
    };
  },
};
