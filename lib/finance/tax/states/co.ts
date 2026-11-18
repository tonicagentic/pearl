import { money, toCents } from "@/lib/finance/agent-money";
import type { WorkpaperLine } from "../types";
import { buildPaymentSummary, pushWp, wp } from "./helpers";
import type { StateComputeContext, StateComputeResult, StateTaxModule } from "./types";

/**
 * Colorado resident tax — flat rate on federal taxable income (± mods not modeled).
 * Capital gains are not preferentially taxed at the state level.
 */
export const coModule: StateTaxModule = {
  id: "CO",
  label: "Colorado",
  compute(ctx: StateComputeContext): StateComputeResult {
    const limitations: string[] = [
      "Colorado uses a flat rate on federal taxable income; state modifications are not modeled.",
      "Colorado does not apply federal preferential capital gains rates — gains are in the flat-rate base.",
    ];
    if (ctx.residentLocality) {
      limitations.push(
        `Locality ${ctx.residentLocality}: Colorado cities have no income tax (OPT/head tax not modeled).`,
      );
    }

    const rate = ctx.tables.states.CO.flatRate;
    const taxable = money(Math.max(0, ctx.federalTaxableIncome));
    const incomeTax = money(taxable * rate);
    const totalTax = incomeTax;

    const workpapers: WorkpaperLine[] = [];
    pushWp(
      workpapers,
      wp(
        "CO",
        "CO-104",
        "1",
        "Federal taxable income",
        ctx.federalTaxableIncome,
        "state_taxable",
      ),
    );
    pushWp(
      workpapers,
      wp("CO", "CO-104", "TI", "Colorado taxable income", taxable, "state_taxable"),
    );
    pushWp(
      workpapers,
      wp(
        "CO",
        "CO-104",
        "tax",
        `Colorado income tax @ ${(rate * 100).toFixed(2)}%`,
        incomeTax,
        "state_tax",
      ),
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
      wp("CO", "CO-104", "wh", "Colorado withholding", ctx.withholdingState, "totals"),
    );
    pushWp(
      workpapers,
      wp(
        "CO",
        "CO-104",
        "est",
        "Estimated tax payments",
        ctx.estimatedPaymentsState,
        "totals",
      ),
    );
    pushWp(
      workpapers,
      wp("CO", "CO-104", "owe", "Amount you owe", pay.balanceDue, "totals"),
    );

    return {
      jurisdiction: "CO",
      tax: totalTax,
      taxableIncome: taxable,
      incomeTax,
      workpapers,
      steps: [
        {
          id: "state_taxable",
          title: "Colorado taxable income",
          stateCents: toCents(taxable),
          details: [
            {
              label: "Starts from federal taxable income",
              amountCents: toCents(ctx.federalTaxableIncome),
            },
          ],
        },
        {
          id: "state_tax",
          title: "Colorado flat income tax",
          stateCents: toCents(totalTax),
          details: [
            {
              label: `Rate ${(rate * 100).toFixed(2)}%`,
              amountCents: toCents(incomeTax),
            },
          ],
        },
      ],
      limitations,
      forms: ["CO-104"],
      summary: { ...pay.summary, id: "CO" },
      local: null,
    };
  },
};
