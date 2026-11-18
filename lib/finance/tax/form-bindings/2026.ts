import type { YearFormBindings } from "./types";
import { bindings2025 } from "./2025";

/**
 * 2026 bindings: start from 2025, override forms whose AcroForm layout changed.
 * Schedule C 2026 draft uses different field indices than 2025.
 */
export const bindings2026: YearFormBindings = {
  year: 2026,
  notes: [
    ...(bindings2025.notes ?? []),
    "Schedule C paths verified against irs-prior/f1040sc--2026.pdf.",
  ],
  forms: {
    ...bindings2025.forms,
    "Schedule C": {
      "identity.legalName": "topmostSubform[0].Page1[0].f1_1[0]",
      "identity.ssn": "topmostSubform[0].Page1[0].f1_2[0]",
      "identity.occupation": "topmostSubform[0].Page1[0].f1_4[0]",
      "line.1": "topmostSubform[0].Page1[0].f1_13[0]",
      "line.7": "topmostSubform[0].Page1[0].f1_19[0]",
      "line.28": "topmostSubform[0].Page1[0].f1_46[0]",
      "line.29": "topmostSubform[0].Page1[0].f1_47[0]",
      "line.30": "topmostSubform[0].Page1[0].f1_50[0]",
      "line.31": "topmostSubform[0].Page1[0].f1_51[0]",
    },
  },
};
