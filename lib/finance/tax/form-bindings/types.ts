/**
 * Year-specific AcroForm bindings.
 * Keys are either identity.* / filingStatus.* or line.<workpaperLine>.
 * Values are full PDF field names (or { field, type } for checkboxes).
 */
export type BindingValue =
  | string
  | { field: string; type: "text" | "checkbox"; checkOn?: string };

export type FormBindings = Record<string, BindingValue>;

export type YearFormBindings = {
  year: number;
  /** notes about mapping confidence */
  notes?: string[];
  forms: Record<string, FormBindings>;
};
