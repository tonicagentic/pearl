import { money, toCents } from "@/lib/finance/agent-money";
import { applyBrackets } from "../brackets";
import type { WorkpaperLine } from "../types";
import { buildPaymentSummary, pushWp, wp } from "./helpers";
import type { StateComputeContext, StateComputeResult, StateTaxModule } from "./types";

/** California resident tax — gains taxed as ordinary; no preferential CG rate. */
export const caModule: StateTaxModule = {
  id: "CA",
  label: "California",
  compute(ctx: StateComputeContext): StateComputeResult {
    const limitations: string[] = [
      "CA starts from federal AGI with no other conformity adjustments modeled yet.",
      "California taxes capital gains as ordinary income (no federal preferential CG rates).",
    ];
    if (ctx.residentLocality) {
      limitations.push(
        `Locality ${ctx.residentLocality} has no CA city income tax — ignored for estimates.`,
      );
    }

    const tables = ctx.tables.states.CA;
    const stdDed = tables.standardDeduction[ctx.status];
    const taxable = money(Math.max(0, ctx.federalAgi - stdDed));
    const incomeTax = money(applyBrackets(taxable, tables.brackets[ctx.status]));
    const mhThreshold = tables.mentalHealthThreshold ?? 1_000_000;
    const mhRate = tables.mentalHealthRate ?? 0.01;
    const mhTax =
      taxable > mhThreshold ? money((taxable - mhThreshold) * mhRate) : 0;
    const totalTax = money(incomeTax + mhTax);

    const workpapers: WorkpaperLine[] = [];
    pushWp(
      workpapers,
      wp("CA", "540", "13", "Federal AGI (from Form 1040)", ctx.federalAgi, "state_taxable"),
    );
    pushWp(
      workpapers,
      wp(
        "CA",
        "Schedule CA (540)",
        "Part II QBI",
        "Federal QBI deduction addback",
        ctx.qbiDeduction,
        "state_taxable",
      ),
    );
    pushWp(
      workpapers,
      wp("CA", "540", "18", "California standard deduction", stdDed, "state_taxable"),
    );
    pushWp(
      workpapers,
      wp("CA", "540", "19", "Taxable income", taxable, "state_taxable"),
    );
    pushWp(workpapers, wp("CA", "540", "31", "Tax", incomeTax, "state_tax"));
    if (mhTax > 0) {
      pushWp(
        workpapers,
        wp("CA", "540", "62", "Mental Health Services Tax", mhTax, "state_tax"),
      );
    }
    pushWp(workpapers, wp("CA", "540", "64", "Total tax", totalTax, "state_tax"));

    const pay = buildPaymentSummary({
      agi: ctx.federalAgi,
      taxableIncome: taxable,
      incomeTax,
      totalTax,
      mentalHealthTax: mhTax,
      priorYearTax: ctx.priorYearStateTax,
      estimatedPayments: ctx.estimatedPaymentsState,
      withholding: ctx.withholdingState,
      safeHarborMultiplier: ctx.safeHarborMultiplier,
    });

    pushWp(
      workpapers,
      wp("CA", "540", "71", "California income tax withheld", ctx.withholdingState, "totals"),
    );
    pushWp(
      workpapers,
      wp(
        "CA",
        "540",
        "72",
        "Estimated tax payments",
        ctx.estimatedPaymentsState,
        "totals",
      ),
    );
    pushWp(
      workpapers,
      wp("CA", "540", "97", "Overpaid (refund)", pay.refund, "totals"),
    );
    pushWp(
      workpapers,
      wp("CA", "540", "111", "Amount you owe", pay.balanceDue, "totals"),
    );

    const steps = [
      {
        id: "state_taxable",
        title: "California taxable income",
        californiaCents: toCents(taxable),
        stateCents: toCents(taxable),
        details: [
          { label: "CA standard deduction", amountCents: toCents(stdDed) },
          {
            label: "Federal QBI not subtracted for CA",
            amountCents: toCents(ctx.qbiDeduction),
          },
        ],
      },
      {
        id: "state_tax",
        title: "California tax + MHST",
        californiaCents: toCents(totalTax),
        stateCents: toCents(totalTax),
        details: [
          { label: "CA income tax", amountCents: toCents(incomeTax) },
          { label: "Mental Health Services Tax", amountCents: toCents(mhTax) },
        ],
      },
    ];

    return {
      jurisdiction: "CA",
      tax: totalTax,
      taxableIncome: taxable,
      incomeTax,
      mentalHealthTax: mhTax,
      workpapers,
      steps,
      limitations,
      forms: ["540", "Schedule CA (540)"],
      summary: { ...pay.summary, id: "CA" },
      local: null,
    };
  },
};
