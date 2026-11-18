import { moneyOf, toCents, money } from "@/lib/finance/agent-money";
import { taxWithPreferentialIncome } from "./brackets";
import { emptySummary } from "./states/helpers";
import { stateModuleFor } from "./states";
import type {
  CalcStep,
  DeductionMethod,
  FormRollup,
  JurisdictionSummary,
  TaxCharacter,
  TaxComputeInput,
  TaxComputation,
  WorkpaperLine,
} from "./types";

function sumBy(
  lines: TaxComputeInput["lines"],
  chars: TaxCharacter[],
): number {
  return lines
    .filter((l) => chars.includes(l.character))
    .reduce((s, l) => s + l.amount, 0);
}

function resolveStatePayments(input: TaxComputeInput) {
  return {
    estimatedPaymentsState:
      input.estimatedPaymentsState ?? input.estimatedPaymentsCa ?? 0,
    estimatedPaymentsLocal: input.estimatedPaymentsLocal ?? 0,
    withholdingState: input.withholdingState ?? input.withholdingCa ?? 0,
    withholdingLocal: input.withholdingLocal ?? 0,
    priorYearStateTax: input.priorYearStateTax ?? input.priorYearCaTax ?? 0,
    priorYearLocalTax: input.priorYearLocalTax ?? 0,
  };
}

export function computeTaxes(input: TaxComputeInput): TaxComputation {
  const limitations: string[] = [];
  const workpapers: WorkpaperLine[] = [];
  const steps: CalcStep[] = [];

  const status = input.filingStatus;
  const tables = input.tables;
  const deductionMethod: DeductionMethod =
    input.deductionMethod === "itemize" ? "itemize" : "standard";
  const residentLocality = input.residentLocality ?? null;
  const payments = resolveStatePayments(input);

  if (input.partYearResident) {
    limitations.push(
      "Part-year resident flagged — full-year resident rules applied; multi-state allocation is not modeled.",
    );
  }
  if (deductionMethod === "itemize") {
    limitations.push(
      "Itemized deduction elected — Schedule A is not modeled; using standard deduction for estimates.",
    );
  }

  // Capital gains from lots
  let stcg = 0;
  let ltcg = 0;
  for (const g of input.capitalGains) {
    const gain = money(g.proceeds - g.basis);
    if (g.term === "short") stcg += gain;
    else ltcg += gain;
  }

  const w2 = sumBy(input.lines, ["w2_wages"]);
  const scheduleC = sumBy(input.lines, ["schedule_c"]);
  const k1Ordinary = sumBy(input.lines, ["k1_ordinary"]);
  const k1QbiOnly = sumBy(input.lines, ["k1_qbi"]);
  const rental = sumBy(input.lines, ["rental"]);
  const interest = sumBy(input.lines, ["interest"]);
  const ordinaryDiv = sumBy(input.lines, ["ordinary_dividends"]);
  const qualifiedDiv = sumBy(input.lines, ["qualified_dividend"]);
  const ltcgLines = sumBy(input.lines, ["ltcg"]);
  const stcgLines = sumBy(input.lines, ["stcg"]);
  const taxExempt = sumBy(input.lines, ["tax_exempt"]);

  ltcg = money(ltcg + ltcgLines);
  stcg = money(stcg + stcgLines);

  const qbiFromLines = input.lines.reduce((s, l) => {
    if (l.character === "schedule_c") {
      return s + Math.max(0, l.qbiAmount ?? l.amount);
    }
    if (l.character === "k1_qbi") return s + Math.max(0, l.amount);
    if (l.character === "k1_ordinary") {
      return s + Math.max(0, l.qbiAmount ?? 0);
    }
    return s;
  }, 0);

  const ordinaryIncome = money(
    w2 +
      scheduleC +
      k1Ordinary +
      k1QbiOnly +
      rental +
      interest +
      ordinaryDiv +
      stcg,
  );
  const preferentialIncome = money(qualifiedDiv + ltcg);
  const grossForAgi = money(ordinaryIncome + preferentialIncome);

  const incomeByCharacter: TaxComputation["incomeByCharacter"] = [];
  const charTotals: Partial<Record<TaxCharacter, number>> = {
    w2_wages: w2,
    schedule_c: scheduleC,
    k1_ordinary: k1Ordinary,
    k1_qbi: k1QbiOnly,
    rental,
    interest,
    ordinary_dividends: ordinaryDiv,
    qualified_dividend: qualifiedDiv,
    ltcg,
    stcg,
    tax_exempt: taxExempt,
  };
  for (const [character, amount] of Object.entries(charTotals) as [
    TaxCharacter,
    number,
  ][]) {
    if (amount !== 0) {
      incomeByCharacter.push({ character, amount: moneyOf(amount) });
    }
  }

  steps.push({
    id: "income",
    title: "Gross income by character",
    description: "Ordinary and preferential buckets before adjustments",
    federalCents: toCents(grossForAgi),
    details: incomeByCharacter.map((r) => ({
      label: r.character,
      amountCents: r.amount.cents,
    })),
  });
  // 1040: 3b includes qualified dividends (3a is the qualified subset).
  const dividendsOrdinaryTotal = money(ordinaryDiv + qualifiedDiv);
  const sch1AdditionalIncome = money(
    scheduleC + k1Ordinary + k1QbiOnly + rental,
  );

  addWp(workpapers, {
    jurisdiction: "federal",
    form: "1040",
    line: "1a",
    label: "Total amount from Form(s) W-2, box 1",
    amountCents: toCents(w2),
    stepId: "income",
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "1040",
    line: "1z",
    label: "Wages (W-2)",
    amountCents: toCents(w2),
    stepId: "income",
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "1040",
    line: "2b",
    label: "Taxable interest",
    amountCents: toCents(interest),
    stepId: "income",
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "1040",
    line: "3a",
    label: "Qualified dividends",
    amountCents: toCents(qualifiedDiv),
    stepId: "income",
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "1040",
    line: "3b",
    label: "Ordinary dividends",
    amountCents: toCents(dividendsOrdinaryTotal),
    stepId: "income",
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "1040",
    line: "7",
    label: "Capital gain (loss)",
    amountCents: toCents(stcg + ltcg),
    stepId: "income",
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "1040",
    line: "8",
    label: "Additional income from Schedule 1",
    amountCents: toCents(sch1AdditionalIncome),
    stepId: "income",
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "1040",
    line: "9",
    label: "Total income",
    amountCents: toCents(grossForAgi),
    stepId: "income",
  });

  // Schedule B (interest / dividends)
  if (interest !== 0 || ordinaryDiv !== 0) {
    addWp(workpapers, {
      jurisdiction: "federal",
      form: "Schedule B",
      line: "2",
      label: "Taxable interest",
      amountCents: toCents(interest),
      stepId: "income",
    });
    addWp(workpapers, {
      jurisdiction: "federal",
      form: "Schedule B",
      line: "6",
      label: "Ordinary dividends",
      amountCents: toCents(ordinaryDiv),
      stepId: "income",
    });
  }

  // Schedule C detail
  const schCLines = input.lines.filter((l) => l.character === "schedule_c");
  const schCGross = schCLines.reduce(
    (s, l) => s + (l.grossReceipts != null ? l.grossReceipts : l.amount),
    0,
  );
  const schCExpenses = schCLines.reduce((s, l) => {
    if (l.expenses != null) return s + l.expenses;
    if (l.grossReceipts != null) return s + Math.max(0, l.grossReceipts - l.amount);
    return s;
  }, 0);
  if (scheduleC !== 0 || schCGross !== 0) {
    if (schCLines.some((l) => l.expenses == null && l.grossReceipts == null)) {
      limitations.push(
        "Schedule C expenses are not fully itemized — PDF uses gross/expense totals when provided, otherwise net on line 31 only.",
      );
    }
    const schCLine1 = schCGross || scheduleC;
    const schCLine7 = money(scheduleC + schCExpenses);
    const schCLine29 = money(schCLine7 - schCExpenses);
    addWp(workpapers, {
      jurisdiction: "federal",
      form: "Schedule C",
      line: "1",
      label: "Gross receipts or sales",
      amountCents: toCents(schCLine1),
      stepId: "income",
    });
    addWp(workpapers, {
      jurisdiction: "federal",
      form: "Schedule C",
      line: "7",
      label: "Gross income",
      amountCents: toCents(schCLine7),
      stepId: "income",
    });
    addWp(workpapers, {
      jurisdiction: "federal",
      form: "Schedule C",
      line: "28",
      label: "Total expenses",
      amountCents: toCents(schCExpenses),
      stepId: "income",
    });
    addWp(workpapers, {
      jurisdiction: "federal",
      form: "Schedule C",
      line: "29",
      label: "Tentative profit (loss)",
      amountCents: toCents(schCLine29),
      stepId: "income",
    });
    // Line 30 (home office) omitted when $0 — reconcile treats missing as 0.
    addWp(workpapers, {
      jurisdiction: "federal",
      form: "Schedule C",
      line: "31",
      label: "Net profit (loss)",
      amountCents: toCents(scheduleC),
      stepId: "income",
    });
    addWp(workpapers, {
      jurisdiction: "federal",
      form: "Schedule 1",
      line: "3",
      label: "Business income (Schedule C)",
      amountCents: toCents(scheduleC),
      stepId: "income",
    });
  }

  if (rental !== 0) {
    addWp(workpapers, {
      jurisdiction: "federal",
      form: "Schedule 1",
      line: "5",
      label: "Rental real estate (Schedule E summary)",
      amountCents: toCents(rental),
      stepId: "income",
    });
  }
  if (k1Ordinary + k1QbiOnly !== 0) {
    addWp(workpapers, {
      jurisdiction: "federal",
      form: "Schedule 1",
      line: "5k",
      label: "Partnership / S-corp (K-1 ordinary)",
      amountCents: toCents(k1Ordinary + k1QbiOnly),
      stepId: "income",
    });
  }
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "Schedule 1",
    line: "10",
    label: "Additional income",
    amountCents: toCents(sch1AdditionalIncome),
    stepId: "income",
  });

  addWp(workpapers, {
    jurisdiction: "federal",
    form: "Schedule D",
    line: "7",
    label: "Short-term capital gain (loss)",
    amountCents: toCents(stcg),
    stepId: "income",
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "Schedule D",
    line: "15",
    label: "Long-term capital gain (loss)",
    amountCents: toCents(ltcg),
    stepId: "income",
  });
  if (stcg !== 0 || ltcg !== 0) {
    const stProceeds = input.capitalGains
      .filter((g) => g.term === "short")
      .reduce((s, g) => s + g.proceeds, 0);
    const stBasis = input.capitalGains
      .filter((g) => g.term === "short")
      .reduce((s, g) => s + g.basis, 0);
    const ltProceeds = input.capitalGains
      .filter((g) => g.term === "long")
      .reduce((s, g) => s + g.proceeds, 0);
    const ltBasis = input.capitalGains
      .filter((g) => g.term === "long")
      .reduce((s, g) => s + g.basis, 0);
    addWp(workpapers, {
      jurisdiction: "federal",
      form: "Form 8949",
      line: "Part I totals",
      label: "Short-term proceeds (summary)",
      amountCents: toCents(stProceeds),
      stepId: "income",
    });
    addWp(workpapers, {
      jurisdiction: "federal",
      form: "Form 8949",
      line: "Part I basis",
      label: "Short-term cost basis (summary)",
      amountCents: toCents(stBasis),
      stepId: "income",
    });
    addWp(workpapers, {
      jurisdiction: "federal",
      form: "Form 8949",
      line: "Part II totals",
      label: "Long-term proceeds (summary)",
      amountCents: toCents(ltProceeds),
      stepId: "income",
    });
    addWp(workpapers, {
      jurisdiction: "federal",
      form: "Form 8949",
      line: "Part II basis",
      label: "Long-term cost basis (summary)",
      amountCents: toCents(ltBasis),
      stepId: "income",
    });
  }

  // --- SE tax ---
  const seNet = Math.max(0, scheduleC);
  const seBase = money(seNet * 0.9235);
  const w2Ss = input.lines
    .filter((l) => l.character === "w2_wages")
    .reduce((s, l) => s + (l.ssWages ?? l.amount), 0);
  const ssRemaining = Math.max(0, tables.se.ssWageBase - w2Ss);
  const ssPortion = money(Math.min(seBase, ssRemaining) * tables.se.ssRate);
  const medicarePortion = money(seBase * tables.se.medicareRate);
  const seTax = money(ssPortion + medicarePortion);
  const seDeduction = money(seTax / 2);

  const w2Medicare = input.lines
    .filter((l) => l.character === "w2_wages")
    .reduce((s, l) => s + (l.medicareWages ?? l.amount), 0);
  const addlBase = money(w2Medicare + seBase);
  const addlThreshold = tables.federal.addlMedicareThreshold[status];
  const addlMedicare = money(
    Math.max(0, addlBase - addlThreshold) * tables.se.addlMedicareRate,
  );

  steps.push({
    id: "se_tax",
    title: "Self-employment & Additional Medicare",
    federalCents: toCents(seTax + addlMedicare),
    details: [
      { label: "SE base (92.35%)", amountCents: toCents(seBase) },
      { label: "Social Security portion", amountCents: toCents(ssPortion) },
      { label: "Medicare portion", amountCents: toCents(medicarePortion) },
      { label: "SE tax", amountCents: toCents(seTax) },
      { label: "Additional Medicare Tax", amountCents: toCents(addlMedicare) },
    ],
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "Schedule SE",
    line: "4a",
    label: "Net earnings from self-employment (92.35%)",
    amountCents: toCents(seBase),
    stepId: "se_tax",
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "Schedule SE",
    line: "12",
    label: "Self-employment tax",
    amountCents: toCents(seTax),
    stepId: "se_tax",
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "Schedule SE",
    line: "13",
    label: "Deductible part of self-employment tax",
    amountCents: toCents(seDeduction),
    stepId: "se_tax",
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "Schedule 2",
    line: "4",
    label: "Self-employment tax",
    amountCents: toCents(seTax),
    stepId: "se_tax",
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "8959",
    line: "18",
    label: "Additional Medicare Tax",
    amountCents: toCents(addlMedicare),
    stepId: "se_tax",
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "Schedule 2",
    line: "11",
    label: "Additional Medicare Tax",
    amountCents: toCents(addlMedicare),
    stepId: "se_tax",
  });

  // --- Above the line ---
  const healthRaw = Math.max(0, input.healthPremiumAnnual);
  const healthDeduction = money(Math.min(healthRaw, seNet));
  if (healthRaw > seNet && healthRaw > 0) {
    limitations.push(
      "SE health insurance deduction capped at net Schedule C earnings (Form 7206-style).",
    );
  }
  const retirement = Math.max(0, input.retirementContributions);
  if (retirement > 0) {
    limitations.push(
      "Retirement contribution deduction recorded without plan-limit validation.",
    );
  }
  const atl = money(seDeduction + healthDeduction + retirement);

  steps.push({
    id: "atl",
    title: "Above-the-line deductions",
    federalCents: toCents(atl),
    details: [
      { label: "Deductible part of SE tax", amountCents: toCents(seDeduction) },
      {
        label: "SE health insurance",
        amountCents: toCents(healthDeduction),
      },
      { label: "Retirement contributions", amountCents: toCents(retirement) },
    ],
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "Schedule 1",
    line: "15",
    label: "Deductible part of self-employment tax",
    amountCents: toCents(seDeduction),
    stepId: "atl",
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "Schedule 1",
    line: "17",
    label: "Self-employed health insurance deduction",
    amountCents: toCents(healthDeduction),
    stepId: "atl",
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "Schedule 1",
    line: "16",
    label: "Self-employed SEP, SIMPLE, and qualified plans",
    amountCents: toCents(retirement),
    stepId: "atl",
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "Schedule 1",
    line: "26",
    label: "Adjustments to income",
    amountCents: toCents(atl),
    stepId: "atl",
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "1040",
    line: "10",
    label: "Adjustments to income",
    amountCents: toCents(atl),
    stepId: "atl",
  });

  const agi = money(grossForAgi - atl);
  steps.push({
    id: "agi",
    title: "Adjusted gross income",
    federalCents: toCents(agi),
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "1040",
    line: "11",
    label: "Adjusted gross income",
    amountCents: toCents(agi),
    stepId: "agi",
  });

  const fedStdDed = tables.federal.standardDeduction[status];
  const afterStd = money(Math.max(0, agi - fedStdDed));
  steps.push({
    id: "std_ded",
    title: "Standard deduction",
    federalCents: toCents(fedStdDed),
    details: [
      { label: "Income after standard deduction", amountCents: toCents(afterStd) },
    ],
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "1040",
    line: "12",
    label: "Standard deduction",
    amountCents: toCents(fedStdDed),
    stepId: "std_ded",
  });

  // --- QBI ---
  const qbiBase = money(Math.max(0, qbiFromLines));
  const qbiThreshold = tables.federal.qbi.threshold[status];
  const phaseWidth = tables.federal.qbi.phaseoutWidth[status];
  let qbiDeduction = money(qbiBase * tables.federal.qbi.rate);
  const tiBeforeQbi = afterStd;
  const qbiLimit = money(Math.max(0, tiBeforeQbi) * tables.federal.qbi.rate);
  qbiDeduction = money(Math.min(qbiDeduction, qbiLimit));

  if (tiBeforeQbi > qbiThreshold) {
    if (tiBeforeQbi < qbiThreshold + phaseWidth) {
      const excess = tiBeforeQbi - qbiThreshold;
      const pct = 1 - excess / phaseWidth;
      qbiDeduction = money(qbiDeduction * Math.max(0, pct));
      limitations.push(
        "QBI is in the phaseout range — W-2 wage / UBIA / SSTB limits are not fully modeled; deduction is linearly reduced.",
      );
    } else {
      qbiDeduction = 0;
      limitations.push(
        "Taxable income is above the QBI phaseout ceiling — QBI deduction set to $0 without W-2/UBIA wage limitation math.",
      );
    }
  }

  steps.push({
    id: "qbi",
    title: "QBI deduction (§199A)",
    federalCents: toCents(qbiDeduction),
    details: [
      { label: "QBI base", amountCents: toCents(qbiBase) },
      { label: "20% of QBI (pre-limit)", amountCents: toCents(qbiBase * 0.2) },
      {
        label: "Limited by 20% of TI before QBI",
        amountCents: toCents(qbiLimit),
      },
    ],
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "Form 8995",
    line: "15",
    label: "Qualified business income deduction",
    amountCents: toCents(qbiDeduction),
    stepId: "qbi",
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "1040",
    line: "13",
    label: "Qualified business income deduction",
    amountCents: toCents(qbiDeduction),
    stepId: "qbi",
  });

  const fedTaxable = money(Math.max(0, tiBeforeQbi - qbiDeduction));
  steps.push({
    id: "taxable",
    title: "Federal taxable income",
    federalCents: toCents(fedTaxable),
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "1040",
    line: "15",
    label: "Taxable income",
    amountCents: toCents(fedTaxable),
    stepId: "taxable",
  });

  const prefInTaxable = money(
    Math.min(preferentialIncome, fedTaxable),
  );
  const taxParts = taxWithPreferentialIncome({
    taxableIncome: fedTaxable,
    qualifiedAndLtcg: prefInTaxable,
    ordinaryBrackets: tables.federal.brackets[status],
    ltcgBrackets: tables.federal.ltcgBrackets[status],
  });
  const federalIncomeTax = money(taxParts.totalTax);

  steps.push({
    id: "fed_tax",
    title: "Federal income tax (incl. QD/LTCG worksheet)",
    federalCents: toCents(federalIncomeTax),
    details: [
      { label: "Tax on ordinary portion", amountCents: toCents(taxParts.ordinaryTax) },
      {
        label: "Tax on qualified dividends / LTCG",
        amountCents: toCents(taxParts.preferentialTax),
      },
    ],
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "QD/LTCG Worksheet",
    line: "25",
    label: "Tax",
    amountCents: toCents(federalIncomeTax),
    stepId: "fed_tax",
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "1040",
    line: "16",
    label: "Tax",
    amountCents: toCents(federalIncomeTax),
    stepId: "fed_tax",
  });

  // NIIT
  const netInvestmentIncome = money(
    Math.max(
      0,
      interest +
        ordinaryDiv +
        qualifiedDiv +
        rental +
        stcg +
        ltcg,
    ),
  );
  const niitThreshold = tables.federal.niitThreshold[status];
  const niit = money(
    Math.min(
      netInvestmentIncome,
      Math.max(0, agi - niitThreshold),
    ) * 0.038,
  );
  steps.push({
    id: "niit",
    title: "Net Investment Income Tax",
    federalCents: toCents(niit),
    details: [
      {
        label: "Net investment income",
        amountCents: toCents(netInvestmentIncome),
      },
    ],
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "8960",
    line: "17",
    label: "Net Investment Income Tax",
    amountCents: toCents(niit),
    stepId: "niit",
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "Schedule 2",
    line: "12",
    label: "Net Investment Income Tax",
    amountCents: toCents(niit),
    stepId: "niit",
  });

  const otherTaxes = money(seTax + addlMedicare + niit);
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "1040",
    line: "23",
    label: "Other taxes (Schedule 2)",
    amountCents: toCents(otherTaxes),
    stepId: "se_tax",
  });

  const federalTotal = money(
    federalIncomeTax + seTax + addlMedicare + niit,
  );
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "1040",
    line: "24",
    label: "Total tax",
    amountCents: toCents(federalTotal),
    stepId: "totals",
  });

  // --- State / local (gated by residency — no silent CA for other states) ---
  const use110 = agi > tables.safeHarbor.agiThreshold;
  const mult = use110
    ? tables.safeHarbor.highMultiplier
    : tables.safeHarbor.normalMultiplier;

  const fedSafe = money(input.priorYearFederalTax * mult);
  const fedPaid = money(input.estimatedPaymentsFederal);
  const fedWh = money(input.withholdingFederal);
  const fedTarget = money(Math.max(federalTotal, fedSafe));
  const fedPayments = money(fedPaid + fedWh);
  const fedBalanceDue = money(Math.max(0, federalTotal - fedPayments));
  const fedRefund = money(Math.max(0, fedPayments - federalTotal));
  const fedRemaining = money(Math.max(0, fedTarget - fedPaid - fedWh));

  addWp(workpapers, {
    jurisdiction: "federal",
    form: "1040",
    line: "25d",
    label: "Federal income tax withheld",
    amountCents: toCents(fedWh),
    stepId: "totals",
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "1040",
    line: "26",
    label: "Estimated tax payments",
    amountCents: toCents(fedPaid),
    stepId: "totals",
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "1040",
    line: "33",
    label: "Total payments",
    amountCents: toCents(fedPayments),
    stepId: "totals",
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "1040",
    line: "34",
    label: "Overpaid (refund)",
    amountCents: toCents(fedRefund),
    stepId: "totals",
  });
  addWp(workpapers, {
    jurisdiction: "federal",
    form: "1040",
    line: "37",
    label: "Amount you owe",
    amountCents: toCents(fedBalanceDue),
    stepId: "totals",
  });

  limitations.push(
    "Federal capital gains: STCG taxed as ordinary; LTCG/QD use preferential brackets; NIIT may apply.",
  );

  if (
    scheduleC !== 0 &&
    !input.businessExpensesReviewed &&
    input.lines.some(
      (l) =>
        l.character === "schedule_c" &&
        (l.expenses == null || l.expenses === 0),
    )
  ) {
    limitations.push(
      "Schedule C business expenses not reviewed for this year — mark reviewed in year setup after entering categories.",
    );
  }

  const stateMod = stateModuleFor(input.residentState);
  let stateResult = null as ReturnType<
    NonNullable<typeof stateMod>["compute"]
  > | null;
  if (stateMod) {
    stateResult = stateMod.compute({
      year: input.year,
      status,
      tables,
      federalAgi: agi,
      federalTaxableIncome: fedTaxable,
      qbiDeduction,
      priorYearStateTax: payments.priorYearStateTax,
      priorYearLocalTax: payments.priorYearLocalTax,
      estimatedPaymentsState: payments.estimatedPaymentsState,
      estimatedPaymentsLocal: payments.estimatedPaymentsLocal,
      withholdingState: payments.withholdingState,
      withholdingLocal: payments.withholdingLocal,
      safeHarborMultiplier: mult,
      residentLocality,
    });
    limitations.push(...stateResult.limitations);
    steps.push(...stateResult.steps);
    workpapers.push(...stateResult.workpapers);
    if (stateResult.local) {
      workpapers.push(...stateResult.local.workpapers);
    }
  } else {
    limitations.push(
      `Resident state ${input.residentState} is not modeled — only federal tax is estimated.`,
    );
  }

  const stateTax = stateResult?.tax ?? 0;
  const localTax = stateResult?.local?.tax ?? 0;
  const stateRemaining = stateResult?.summary.remaining.usd ?? 0;
  const localRemaining = stateResult?.local?.summary.remaining.usd ?? 0;

  const combinedTotal = money(federalTotal + stateTax + localTax);
  const combinedRemaining = money(
    fedRemaining + stateRemaining + localRemaining,
  );

  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  const quartersLeft = Math.max(1, 5 - q);
  const nextPayment = money(combinedRemaining / quartersLeft);
  const setAside = money(combinedTotal / 12);

  steps.push({
    id: "totals",
    title: "Totals & estimates",
    federalCents: toCents(federalTotal),
    californiaCents:
      input.residentState === "CA" ? toCents(stateTax) : undefined,
    stateCents: toCents(stateTax),
    localCents: localTax ? toCents(localTax) : undefined,
    details: [
      { label: "Federal remaining", amountCents: toCents(fedRemaining) },
      {
        label: `${stateResult?.jurisdiction ?? "State"} remaining`,
        amountCents: toCents(stateRemaining),
      },
      ...(localTax
        ? [
            {
              label: "Local remaining",
              amountCents: toCents(localRemaining),
            },
          ]
        : []),
      {
        label: "Next payment suggestion",
        amountCents: toCents(nextPayment),
      },
    ],
  });

  const federal: JurisdictionSummary = {
    agi: moneyOf(agi),
    taxableIncome: moneyOf(fedTaxable),
    incomeTax: moneyOf(federalIncomeTax),
    seTax: moneyOf(seTax),
    addlMedicare: moneyOf(addlMedicare),
    niit: moneyOf(niit),
    totalTax: moneyOf(federalTotal),
    safeHarbor: moneyOf(fedSafe),
    paidEstimates: moneyOf(fedPaid),
    withholding: moneyOf(fedWh),
    remaining: moneyOf(fedRemaining),
  };

  const stateSummary = stateResult?.summary ?? null;
  const localSummary = stateResult?.local?.summary ?? null;
  const california: JurisdictionSummary =
    input.residentState === "CA" && stateSummary
      ? stateSummary
      : emptySummary(agi);

  // Situation gating: drop empty optional forms when flag explicitly false
  const gated = gateWorkpapersBySituations(workpapers, input, {
    scheduleC,
    interest,
    ordinaryDiv,
    stcg,
    ltcg,
    rental,
    k1Ordinary,
    k1QbiOnly,
    w2,
  });
  const forms = rollupForms(gated);

  const notes = [
    ...limitations,
    `Safe harbor uses ${use110 ? "110%" : "100%"} of prior-year tax.`,
    "Printable return PDFs are for review only — not e-filed.",
  ];

  return {
    year: input.year,
    filingStatus: status,
    residentState: input.residentState,
    residentLocality,
    deductionMethod,
    federal,
    state: stateSummary,
    local: localSummary,
    california,
    combined: {
      totalTax: moneyOf(combinedTotal),
      remaining: moneyOf(combinedRemaining),
      nextPaymentSuggestion: moneyOf(nextPayment),
      setAside: moneyOf(setAside),
    },
    incomeByCharacter,
    steps,
    workpapers: gated,
    forms,
    limitations,
    legacy: {
      ordinaryIncome,
      scheduleC,
      w2,
      k1: money(k1Ordinary + k1QbiOnly),
      qbiDeduction,
      seTax,
      healthDeduction,
      healthDeductionSource:
        healthDeduction > 0 ? "plans" : ("none" as const),
      agiEstimate: agi,
      taxableIncome: fedTaxable,
      federalIncomeTax,
      californiaTax: input.residentState === "CA" ? stateTax : 0,
      stateTax,
      localTax,
      totalTax: combinedTotal,
      safeHarbor: money(
        fedSafe +
          (stateSummary?.safeHarbor.usd ?? 0) +
          (localSummary?.safeHarbor.usd ?? 0),
      ),
      paidEstimates: money(
        fedPaid +
          payments.estimatedPaymentsState +
          payments.estimatedPaymentsLocal,
      ),
      withholding: money(
        fedWh + payments.withholdingState + payments.withholdingLocal,
      ),
      remaining: combinedRemaining,
      nextPaymentSuggestion: nextPayment,
      setAside,
      notes,
    },
  };
}

/** Drop optional form workpapers when situation is explicitly off and amounts are zero. */
function gateWorkpapersBySituations(
  workpapers: WorkpaperLine[],
  input: TaxComputeInput,
  amounts: {
    scheduleC: number;
    interest: number;
    ordinaryDiv: number;
    stcg: number;
    ltcg: number;
    rental: number;
    k1Ordinary: number;
    k1QbiOnly: number;
    w2: number;
  },
): WorkpaperLine[] {
  const s = input.situations ?? {};
  const skip = new Set<string>();

  if (s.hasSelfEmployment === false && amounts.scheduleC === 0) {
    skip.add("Schedule C");
    skip.add("Schedule SE");
  }
  if (
    s.hasInvestments === false &&
    amounts.interest === 0 &&
    amounts.ordinaryDiv === 0 &&
    amounts.stcg === 0 &&
    amounts.ltcg === 0
  ) {
    skip.add("Schedule B");
    skip.add("Schedule D");
    skip.add("Form 8949");
    skip.add("QD/LTCG Worksheet");
    skip.add("8960");
  }
  if (s.hasRental === false && amounts.rental === 0) {
    // rental only appears on Schedule 1 lines — keep Schedule 1
  }
  if (
    s.hasK1 === false &&
    amounts.k1Ordinary === 0 &&
    amounts.k1QbiOnly === 0
  ) {
    /* no dedicated K-1 form yet */
  }
  if (s.hasW2 === false && amounts.w2 === 0) {
    /* W-2 lines stay on 1040 when zero via addWp skip */
  }

  if (skip.size === 0) return workpapers;
  return workpapers.filter((w) => !skip.has(w.form));
}

function addWp(list: WorkpaperLine[], line: WorkpaperLine) {
  if (line.amountCents === 0) return;
  list.push(line);
}

function rollupForms(workpapers: WorkpaperLine[]): FormRollup[] {
  const map = new Map<string, FormRollup>();
  for (const w of workpapers) {
    const key = `${w.jurisdiction}:${w.form}`;
    const cur = map.get(key) ?? {
      form: w.form,
      jurisdiction: w.jurisdiction,
      lineCount: 0,
      totalCents: 0,
    };
    cur.lineCount += 1;
    cur.totalCents += w.amountCents;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => a.form.localeCompare(b.form));
}
