import type {
  Bracket,
  BracketStateTables,
  FilingStatus,
  FlatStateTables,
  YearTaxTables,
} from "./types";

/** Approximate IRS/FTB/CO/NY tables for planning — replace with official pubs each year. */
export function defaultTablesForYear(year: number): YearTaxTables {
  if (year >= 2026) return tables2026();
  return tables2025();
}

function caTables(): BracketStateTables {
  return {
    standardDeduction: {
      single: 5540,
      mfs: 5540,
      mfj: 11080,
      hoh: 11080,
    },
    brackets: {
      single: caSingleBrackets(),
      mfs: caSingleBrackets(),
      mfj: caMfjBrackets(),
      hoh: caHohBrackets(),
    },
    mentalHealthRate: 0.01,
    mentalHealthThreshold: 1000000,
  };
}

function coTables(): FlatStateTables {
  // Colorado flat rate (planning approx; confirm via tax:refresh-rates)
  return { flatRate: 0.044 };
}

function nyTables(): BracketStateTables {
  return {
    standardDeduction: {
      single: 8000,
      mfs: 8000,
      mfj: 16050,
      hoh: 11200,
    },
    brackets: {
      single: nySingleBrackets(),
      mfs: nySingleBrackets(),
      mfj: nyMfjBrackets(),
      hoh: nyHohBrackets(),
    },
  };
}

function nycTables(): BracketStateTables {
  // NYC resident tax — approximate brackets for planning
  return {
    standardDeduction: {
      single: 0,
      mfs: 0,
      mfj: 0,
      hoh: 0,
    },
    brackets: {
      single: [
        { upTo: 12000, rate: 0.03078 },
        { upTo: 25000, rate: 0.03762 },
        { upTo: 50000, rate: 0.03819 },
        { upTo: null, rate: 0.03876 },
      ],
      mfs: [
        { upTo: 12000, rate: 0.03078 },
        { upTo: 25000, rate: 0.03762 },
        { upTo: 50000, rate: 0.03819 },
        { upTo: null, rate: 0.03876 },
      ],
      mfj: [
        { upTo: 21600, rate: 0.03078 },
        { upTo: 45000, rate: 0.03762 },
        { upTo: 90000, rate: 0.03819 },
        { upTo: null, rate: 0.03876 },
      ],
      hoh: [
        { upTo: 14400, rate: 0.03078 },
        { upTo: 30000, rate: 0.03762 },
        { upTo: 60000, rate: 0.03819 },
        { upTo: null, rate: 0.03876 },
      ],
    },
  };
}

function tables2025(): YearTaxTables {
  const ca = caTables();
  return {
    federal: {
      standardDeduction: {
        single: 15000,
        mfs: 15000,
        mfj: 30000,
        hoh: 22500,
      },
      brackets: {
        single: [
          { upTo: 11925, rate: 0.1 },
          { upTo: 48475, rate: 0.12 },
          { upTo: 103350, rate: 0.22 },
          { upTo: 197300, rate: 0.24 },
          { upTo: 250525, rate: 0.32 },
          { upTo: 626350, rate: 0.35 },
          { upTo: null, rate: 0.37 },
        ],
        mfs: [
          { upTo: 11925, rate: 0.1 },
          { upTo: 48475, rate: 0.12 },
          { upTo: 103350, rate: 0.22 },
          { upTo: 197300, rate: 0.24 },
          { upTo: 250525, rate: 0.32 },
          { upTo: 313175, rate: 0.35 },
          { upTo: null, rate: 0.37 },
        ],
        mfj: [
          { upTo: 23850, rate: 0.1 },
          { upTo: 96950, rate: 0.12 },
          { upTo: 206700, rate: 0.22 },
          { upTo: 394600, rate: 0.24 },
          { upTo: 501050, rate: 0.32 },
          { upTo: 751600, rate: 0.35 },
          { upTo: null, rate: 0.37 },
        ],
        hoh: [
          { upTo: 17000, rate: 0.1 },
          { upTo: 64850, rate: 0.12 },
          { upTo: 103350, rate: 0.22 },
          { upTo: 197300, rate: 0.24 },
          { upTo: 250500, rate: 0.32 },
          { upTo: 626350, rate: 0.35 },
          { upTo: null, rate: 0.37 },
        ],
      },
      ltcgBrackets: {
        single: [
          { upTo: 48350, rate: 0 },
          { upTo: 533400, rate: 0.15 },
          { upTo: null, rate: 0.2 },
        ],
        mfs: [
          { upTo: 24175, rate: 0 },
          { upTo: 266700, rate: 0.15 },
          { upTo: null, rate: 0.2 },
        ],
        mfj: [
          { upTo: 96700, rate: 0 },
          { upTo: 600050, rate: 0.15 },
          { upTo: null, rate: 0.2 },
        ],
        hoh: [
          { upTo: 64750, rate: 0 },
          { upTo: 566700, rate: 0.15 },
          { upTo: null, rate: 0.2 },
        ],
      },
      qbi: {
        rate: 0.2,
        threshold: { single: 197300, mfs: 197300, mfj: 394600, hoh: 197300 },
        phaseoutWidth: { single: 50000, mfs: 50000, mfj: 100000, hoh: 50000 },
      },
      niitThreshold: {
        single: 200000,
        mfs: 125000,
        mfj: 250000,
        hoh: 200000,
      },
      addlMedicareThreshold: {
        single: 200000,
        mfs: 125000,
        mfj: 250000,
        hoh: 200000,
      },
    },
    ca,
    states: {
      CA: ca,
      CO: coTables(),
      NY: nyTables(),
    },
    localities: {
      NYC: nycTables(),
    },
    se: {
      ssWageBase: 176100,
      ssRate: 0.124,
      medicareRate: 0.029,
      addlMedicareRate: 0.009,
    },
    safeHarbor: {
      agiThreshold: 150000,
      highMultiplier: 1.1,
      normalMultiplier: 1.0,
    },
  };
}

function tables2026(): YearTaxTables {
  const t = tables2025();
  t.federal.standardDeduction = {
    single: 15750,
    mfs: 15750,
    mfj: 31500,
    hoh: 23625,
  };
  t.se.ssWageBase = 184500;
  t.federal.qbi.threshold = {
    single: 201975,
    mfs: 201975,
    mfj: 403950,
    hoh: 201975,
  };
  return t;
}

function caSingleBrackets(): Bracket[] {
  return [
    { upTo: 10756, rate: 0.01 },
    { upTo: 25499, rate: 0.02 },
    { upTo: 40245, rate: 0.04 },
    { upTo: 55866, rate: 0.06 },
    { upTo: 70606, rate: 0.08 },
    { upTo: 360659, rate: 0.093 },
    { upTo: 432787, rate: 0.103 },
    { upTo: 721314, rate: 0.113 },
    { upTo: null, rate: 0.123 },
  ];
}

function caMfjBrackets(): Bracket[] {
  return [
    { upTo: 21512, rate: 0.01 },
    { upTo: 50998, rate: 0.02 },
    { upTo: 80490, rate: 0.04 },
    { upTo: 111732, rate: 0.06 },
    { upTo: 141212, rate: 0.08 },
    { upTo: 721318, rate: 0.093 },
    { upTo: 865574, rate: 0.103 },
    { upTo: 1442628, rate: 0.113 },
    { upTo: null, rate: 0.123 },
  ];
}

function caHohBrackets(): Bracket[] {
  return [
    { upTo: 21527, rate: 0.01 },
    { upTo: 51000, rate: 0.02 },
    { upTo: 65750, rate: 0.04 },
    { upTo: 81400, rate: 0.06 },
    { upTo: 96550, rate: 0.08 },
    { upTo: 490985, rate: 0.093 },
    { upTo: 589185, rate: 0.103 },
    { upTo: 981785, rate: 0.113 },
    { upTo: null, rate: 0.123 },
  ];
}

function nySingleBrackets(): Bracket[] {
  return [
    { upTo: 8500, rate: 0.04 },
    { upTo: 11700, rate: 0.045 },
    { upTo: 13900, rate: 0.0525 },
    { upTo: 80650, rate: 0.055 },
    { upTo: 215400, rate: 0.06 },
    { upTo: 1077550, rate: 0.0685 },
    { upTo: 5000000, rate: 0.0965 },
    { upTo: 25000000, rate: 0.103 },
    { upTo: null, rate: 0.109 },
  ];
}

function nyMfjBrackets(): Bracket[] {
  return [
    { upTo: 17150, rate: 0.04 },
    { upTo: 23600, rate: 0.045 },
    { upTo: 27900, rate: 0.0525 },
    { upTo: 161550, rate: 0.055 },
    { upTo: 323200, rate: 0.06 },
    { upTo: 2155350, rate: 0.0685 },
    { upTo: 5000000, rate: 0.0965 },
    { upTo: 25000000, rate: 0.103 },
    { upTo: null, rate: 0.109 },
  ];
}

function nyHohBrackets(): Bracket[] {
  return [
    { upTo: 12800, rate: 0.04 },
    { upTo: 17650, rate: 0.045 },
    { upTo: 20900, rate: 0.0525 },
    { upTo: 107650, rate: 0.055 },
    { upTo: 269300, rate: 0.06 },
    { upTo: 1616450, rate: 0.0685 },
    { upTo: 5000000, rate: 0.0965 },
    { upTo: 25000000, rate: 0.103 },
    { upTo: null, rate: 0.109 },
  ];
}

export function parseTablesJson(
  raw: string | null | undefined,
  year: number,
  fallback: {
    standardDeduction: number;
    ssWageBase: number;
    seSocialSecurityRate: number;
    seMedicareRate: number;
    federalBracketsJson: string;
    caBracketsJson: string;
    caMentalHealthRate: number;
    caMentalHealthThreshold: number;
    qbiSimpleRate: number;
  },
): YearTaxTables {
  const base = defaultTablesForYear(year);
  if (raw && raw !== "{}") {
    try {
      const parsed = JSON.parse(raw) as Partial<YearTaxTables> & {
        ca?: BracketStateTables;
      };
      return normalizeTables(deepMergeTables(base, parsed));
    } catch {
      /* fall through */
    }
  }
  try {
    const fed = JSON.parse(fallback.federalBracketsJson) as Bracket[];
    const ca = JSON.parse(fallback.caBracketsJson) as Bracket[];
    base.federal.brackets.single = fed;
    base.ca.brackets.single = ca;
    base.states.CA.brackets.single = ca;
  } catch {
    /* keep defaults */
  }
  base.federal.standardDeduction.single = fallback.standardDeduction;
  base.se.ssWageBase = fallback.ssWageBase;
  base.se.ssRate = fallback.seSocialSecurityRate;
  base.se.medicareRate = fallback.seMedicareRate;
  base.ca.mentalHealthRate = fallback.caMentalHealthRate;
  base.ca.mentalHealthThreshold = fallback.caMentalHealthThreshold;
  base.states.CA.mentalHealthRate = fallback.caMentalHealthRate;
  base.states.CA.mentalHealthThreshold = fallback.caMentalHealthThreshold;
  base.federal.qbi.rate = fallback.qbiSimpleRate;
  return normalizeTables(base);
}

/** Ensure states/localities present and ca mirrors states.CA. */
export function normalizeTables(tables: YearTaxTables): YearTaxTables {
  const defaults = defaultTablesForYear(2025);
  const ca = tables.states?.CA ?? tables.ca ?? defaults.states.CA;
  return {
    ...tables,
    ca,
    states: {
      CA: ca,
      CO: tables.states?.CO ?? defaults.states.CO,
      NY: tables.states?.NY ?? defaults.states.NY,
    },
    localities: {
      NYC: tables.localities?.NYC ?? defaults.localities.NYC,
    },
  };
}

function deepMergeTables(
  base: YearTaxTables,
  patch: Partial<YearTaxTables>,
): YearTaxTables {
  return {
    ...base,
    ...patch,
    federal: { ...base.federal, ...(patch.federal ?? {}) },
    ca: { ...base.ca, ...(patch.ca ?? {}) },
    states: {
      CA: { ...base.states.CA, ...(patch.states?.CA ?? patch.ca ?? {}) },
      CO: { ...base.states.CO, ...(patch.states?.CO ?? {}) },
      NY: { ...base.states.NY, ...(patch.states?.NY ?? {}) },
    },
    localities: {
      NYC: { ...base.localities.NYC, ...(patch.localities?.NYC ?? {}) },
    },
    se: { ...base.se, ...(patch.se ?? {}) },
    safeHarbor: { ...base.safeHarbor, ...(patch.safeHarbor ?? {}) },
  };
}

export function formTypeToCharacter(
  formType: string,
  taxCharacter?: string | null,
): import("./types").TaxCharacter {
  if (taxCharacter) return taxCharacter as import("./types").TaxCharacter;
  switch (formType) {
    case "w2":
      return "w2_wages";
    case "schedule_c":
      return "schedule_c";
    case "k1":
      return "k1_ordinary";
    case "schedule_e":
      return "rental";
    case "investments":
      return "ordinary_dividends";
    default:
      return "schedule_c";
  }
}

export function statusOrSingle(
  status: string | null | undefined,
): FilingStatus {
  if (status === "mfj" || status === "mfs" || status === "hoh") return status;
  return "single";
}
