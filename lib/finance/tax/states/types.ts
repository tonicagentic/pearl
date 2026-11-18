import type {
  CalcStep,
  FilingStatus,
  JurisdictionSummary,
  TaxJurisdiction,
  WorkpaperLine,
  YearTaxTables,
} from "../types";

export type StateComputeContext = {
  year: number;
  status: FilingStatus;
  tables: YearTaxTables;
  /** Federal AGI */
  federalAgi: number;
  /** Federal taxable income (after QBI) — used by CO / NY starting points */
  federalTaxableIncome: number;
  /** Federal QBI deduction (CA addback) */
  qbiDeduction: number;
  priorYearStateTax: number;
  priorYearLocalTax: number;
  estimatedPaymentsState: number;
  estimatedPaymentsLocal: number;
  withholdingState: number;
  withholdingLocal: number;
  safeHarborMultiplier: number;
  residentLocality: string | null;
};

export type StateComputeResult = {
  jurisdiction: TaxJurisdiction;
  tax: number;
  taxableIncome: number;
  incomeTax: number;
  mentalHealthTax?: number;
  workpapers: WorkpaperLine[];
  steps: CalcStep[];
  limitations: string[];
  forms: string[];
  summary: JurisdictionSummary;
  /** Local module result when locality applies */
  local?: StateComputeResult | null;
};

export type StateTaxModule = {
  id: "CA" | "CO" | "NY";
  label: string;
  compute: (ctx: StateComputeContext) => StateComputeResult;
};
