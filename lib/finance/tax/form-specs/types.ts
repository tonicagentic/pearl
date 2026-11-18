/**
 * Declarative line specs for instruction-backed reconcile + binding coverage.
 * Specs are curated TypeScript (not scraped at runtime).
 */

export type FormLineKind =
  | "input"
  | "sum"
  | "diff"
  | "carry"
  | "identity"
  | "checkbox";

export type FormLineSpec = {
  form: string;
  /** Matches WorkpaperLine.line */
  lineId: string;
  label: string;
  kind: FormLineKind;
  /**
   * For sum/diff: other lineIds on the same form (unless sourceForm set per entry).
   * For carry: single source lineId (possibly on another form).
   */
  sources?: string[];
  /** When carry/sum sources live on another form */
  sourceForm?: string;
  /** Human pointer into IRS instructions, e.g. "i1040 Line 9" */
  instructionRef?: string;
  /** If set, reconcile only when this workpaper line is present/nonzero */
  requiredWhenLine?: { form: string; lineId: string };
};

export type YearSpinePack = {
  year: number;
  forms: string[];
  notes?: string[];
  lines: FormLineSpec[];
  /** Binding keys that are identity/checkbox (not line.*) */
  identityKeys?: string[];
};
