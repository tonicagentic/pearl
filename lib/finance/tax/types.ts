import type { Money } from "@/lib/finance/agent-money";

export type FilingStatus = "single" | "mfj" | "mfs" | "hoh";

export type TaxCharacter =
  | "w2_wages"
  | "schedule_c"
  | "k1_ordinary"
  | "k1_qbi"
  | "rental"
  | "interest"
  | "ordinary_dividends"
  | "qualified_dividend"
  | "ltcg"
  | "stcg"
  | "tax_exempt";

export type Bracket = { upTo: number | null; rate: number };

export type StatusKeyed<T> = Record<FilingStatus, T>;

export type TaxJurisdiction =
  | "federal"
  | "CA"
  | "CO"
  | "NY"
  | "NYC"
  | "combined";

export type DeductionMethod = "standard" | "itemize";

/** Flat-rate state (Colorado). */
export type FlatStateTables = {
  flatRate: number;
  /** Optional standard deduction if state uses one separately from federal TI */
  standardDeduction?: StatusKeyed<number>;
};

/** Progressive state with brackets (CA, NY). */
export type BracketStateTables = {
  standardDeduction: StatusKeyed<number>;
  brackets: StatusKeyed<Bracket[]>;
  mentalHealthRate?: number;
  mentalHealthThreshold?: number;
};

export type YearTaxTables = {
  federal: {
    standardDeduction: StatusKeyed<number>;
    brackets: StatusKeyed<Bracket[]>;
    /** Taxable-income thresholds for 0% / 15% / 20% LTCG+QD rates */
    ltcgBrackets: StatusKeyed<Bracket[]>;
    qbi: {
      rate: number;
      threshold: StatusKeyed<number>;
      phaseoutWidth: StatusKeyed<number>;
    };
    niitThreshold: StatusKeyed<number>;
    addlMedicareThreshold: StatusKeyed<number>;
  };
  /** @deprecated Prefer states.CA — kept for tablesJson backward compat */
  ca: BracketStateTables;
  states: {
    CA: BracketStateTables;
    CO: FlatStateTables;
    NY: BracketStateTables;
  };
  localities: {
    NYC: BracketStateTables;
  };
  se: {
    ssWageBase: number;
    ssRate: number;
    medicareRate: number;
    addlMedicareRate: number;
  };
  safeHarbor: {
    agiThreshold: number;
    highMultiplier: number;
    normalMultiplier: number;
  };
};

export type TaxIncomeLine = {
  id?: string;
  label: string;
  character: TaxCharacter;
  amount: number;
  qbiAmount?: number | null;
  ssWages?: number | null;
  medicareWages?: number | null;
  /** Schedule C PDF: gross receipts (optional) */
  grossReceipts?: number | null;
  /** Schedule C PDF: total expenses (optional) */
  expenses?: number | null;
};

/** Filer identity for printable return PDFs (SSN already decrypted when passed). */
export type TaxFilerIdentity = {
  legalName: string;
  occupation: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  ssn: string;
  spouseLegalName: string;
  spouseSsn: string;
};

export type TaxCapitalLine = {
  id?: string;
  description: string;
  proceeds: number;
  basis: number;
  term: "long" | "short";
};

export type TaxSituationFlags = {
  hasW2?: boolean | null;
  hasSelfEmployment?: boolean | null;
  hasInvestments?: boolean | null;
  hasRental?: boolean | null;
  hasK1?: boolean | null;
  hasDependents?: boolean | null;
};

export type TaxComputeInput = {
  year: number;
  filingStatus: FilingStatus;
  residentState: string;
  residentLocality?: string | null;
  partYearResident?: boolean;
  deductionMethod?: DeductionMethod;
  situations?: TaxSituationFlags;
  businessExpensesReviewed?: boolean;
  tables: YearTaxTables;
  lines: TaxIncomeLine[];
  capitalGains: TaxCapitalLine[];
  healthPremiumAnnual: number;
  retirementContributions: number;
  estimatedPaymentsFederal: number;
  estimatedPaymentsState: number;
  estimatedPaymentsLocal: number;
  withholdingFederal: number;
  withholdingState: number;
  withholdingLocal: number;
  priorYearFederalTax: number;
  priorYearStateTax: number;
  priorYearLocalTax: number;
  /** @deprecated Use estimatedPaymentsState */
  estimatedPaymentsCa?: number;
  /** @deprecated Use withholdingState */
  withholdingCa?: number;
  /** @deprecated Use priorYearStateTax */
  priorYearCaTax?: number;
};

export type WorkpaperLine = {
  jurisdiction: TaxJurisdiction;
  form: string;
  line: string;
  label: string;
  amountCents: number;
  stepId: string;
};

export type CalcStep = {
  id: string;
  title: string;
  description?: string;
  federalCents?: number;
  californiaCents?: number;
  stateCents?: number;
  localCents?: number;
  details?: { label: string; amountCents: number }[];
};

export type FormRollup = {
  form: string;
  jurisdiction: TaxJurisdiction;
  lineCount: number;
  totalCents: number;
};

export type JurisdictionSummary = {
  id?: string;
  agi: Money;
  taxableIncome: Money;
  incomeTax: Money;
  seTax?: Money;
  addlMedicare?: Money;
  niit?: Money;
  mentalHealthTax?: Money;
  totalTax: Money;
  safeHarbor: Money;
  paidEstimates: Money;
  withholding: Money;
  remaining: Money;
};

export type TaxComputation = {
  year: number;
  filingStatus: FilingStatus;
  residentState: string;
  residentLocality: string | null;
  deductionMethod: DeductionMethod;
  federal: JurisdictionSummary;
  /** Active state module summary (CA / CO / NY) */
  state: JurisdictionSummary | null;
  /** Local income tax (NYC) when applicable */
  local: JurisdictionSummary | null;
  /**
   * @deprecated Alias of `state` when residentState is CA; otherwise zeroed CA-shaped summary for old UI.
   */
  california: JurisdictionSummary;
  combined: {
    totalTax: Money;
    remaining: Money;
    nextPaymentSuggestion: Money;
    setAside: Money;
  };
  incomeByCharacter: { character: TaxCharacter; amount: Money }[];
  steps: CalcStep[];
  workpapers: WorkpaperLine[];
  forms: FormRollup[];
  limitations: string[];
  /** Legacy-compatible flat fields for older callers */
  legacy: {
    ordinaryIncome: number;
    scheduleC: number;
    w2: number;
    k1: number;
    qbiDeduction: number;
    seTax: number;
    healthDeduction: number;
    healthDeductionSource: "plans" | "events" | "none";
    agiEstimate: number;
    taxableIncome: number;
    federalIncomeTax: number;
    californiaTax: number;
    stateTax: number;
    localTax: number;
    totalTax: number;
    safeHarbor: number;
    paidEstimates: number;
    withholding: number;
    remaining: number;
    nextPaymentSuggestion: number;
    setAside: number;
    notes: string[];
  };
};

export type BusinessExpenseCategory =
  | "advertising"
  | "carTruck"
  | "contractLabor"
  | "depreciation"
  | "insurance"
  | "legalProfessional"
  | "officeExpense"
  | "supplies"
  | "travel"
  | "meals"
  | "utilities"
  | "other";

export const BUSINESS_EXPENSE_CATEGORIES: {
  id: BusinessExpenseCategory;
  label: string;
}[] = [
  { id: "advertising", label: "Advertising" },
  { id: "carTruck", label: "Car and truck" },
  { id: "contractLabor", label: "Contract labor" },
  { id: "depreciation", label: "Depreciation" },
  { id: "insurance", label: "Insurance (other than health)" },
  { id: "legalProfessional", label: "Legal and professional" },
  { id: "officeExpense", label: "Office expense" },
  { id: "supplies", label: "Supplies" },
  { id: "travel", label: "Travel" },
  { id: "meals", label: "Meals (50% deductible)" },
  { id: "utilities", label: "Utilities" },
  { id: "other", label: "Other" },
];
