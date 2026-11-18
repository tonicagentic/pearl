import { createHash } from "node:crypto";
import { mapXeroRelatedAccount } from "@/lib/finance/xero-related-account";

export type StatementAmountConvention = "books" | "bank";
/** books: negative = outflow (matches our ledger). bank: positive = spend (common card exports). */

export type ParsedStatementRow = {
  date: Date;
  amount: number; // ledger sign: + inflow, - outflow
  type: "income" | "expense" | "transfer" | "tax_payment";
  memo: string;
  importKey: string;
  /** Raw Related account / category label when present (e.g. Xero). */
  relatedAccount: string | null;
  /** Resolved app category slug from Related account mapping. */
  categorySlug: string | null;
};

export type StatementParseResult = {
  rows: ParsedStatementRow[];
  skipped: number;
  headers: string[];
  detected: {
    dateColumn: string | null;
    amountColumn: string | null;
    debitColumn: string | null;
    creditColumn: string | null;
    memoColumn: string | null;
    relatedColumn: string | null;
  };
  errors: string[];
};

const DATE_HEADERS = [
  "date",
  "transaction date",
  "trans date",
  "posted date",
  "posting date",
  "post date",
  "settled date",
  "txn date",
];
const AMOUNT_HEADERS = ["amount", "transaction amount", "amt", "value"];
const DEBIT_HEADERS = ["debit", "withdrawal", "withdrawals", "charge", "charges"];
const CREDIT_HEADERS = ["credit", "deposit", "deposits", "payment", "payments"];
const MEMO_HEADERS = [
  "description",
  "memo",
  "name",
  "payee",
  "merchant",
  "details",
  "narrative",
  "transaction",
  "transaction description",
];
const RELATED_HEADERS = [
  "related account",
  "related",
  "account code",
  "category",
  "chart of accounts",
  "coa",
];

function normalizeHeader(h: string) {
  return h.replace(/^\uFEFF/, "").trim().toLowerCase();
}

/** Minimal RFC4180-ish CSV parse (handles quotes and commas). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  const input = text.replace(/^\uFEFF/, "");

  while (i < input.length) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function findHeader(headers: string[], candidates: string[]) {
  for (const c of candidates) {
    const idx = headers.findIndex((h) => h === c);
    if (idx >= 0) return { index: idx, name: headers[idx]! };
  }
  for (const c of candidates) {
    const idx = headers.findIndex((h) => h.includes(c));
    if (idx >= 0) return { index: idx, name: headers[idx]! };
  }
  return null;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw
    .replace(/[$£€]/g, "")
    .replace(/\s/g, "")
    .replace(/^\((.*)\)$/, "-$1")
    .replace(/,/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseFlexibleDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const mdy = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/.exec(s);
  if (mdy) {
    let y = Number(mdy[3]);
    if (y < 100) y += 2000;
    const a = Number(mdy[1]);
    const b = Number(mdy[2]);
    // Prefer US M/D/Y when first part > 12 impossible for day-first of that month
    const monthFirst = a <= 12;
    const month = monthFirst ? a : b;
    const day = monthFirst ? b : a;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(y, month - 1, day, 12, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(s);
  if (Number.isNaN(fallback.getTime())) return null;
  return new Date(
    fallback.getFullYear(),
    fallback.getMonth(),
    fallback.getDate(),
    12,
    0,
    0,
    0,
  );
}

export function statementImportKey(
  accountId: string,
  date: Date,
  amount: number,
  memo: string,
) {
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const payload = `${accountId}|${day}|${amount.toFixed(2)}|${memo.trim().toLowerCase()}`;
  const hash = createHash("sha256").update(payload).digest("hex").slice(0, 32);
  return `import:${hash}`;
}

export function parseStatementCsv(
  text: string,
  opts: {
    accountId: string;
    amountConvention: StatementAmountConvention;
  },
): StatementParseResult {
  const table = parseCsv(text);
  const errors: string[] = [];
  if (table.length < 2) {
    return {
      rows: [],
      skipped: 0,
      headers: [],
      detected: {
        dateColumn: null,
        amountColumn: null,
        debitColumn: null,
        creditColumn: null,
        memoColumn: null,
        relatedColumn: null,
      },
      errors: ["CSV needs a header row and at least one data row."],
    };
  }

  const headers = table[0]!.map(normalizeHeader);
  const dateHit = findHeader(headers, DATE_HEADERS);
  const amountHit = findHeader(headers, AMOUNT_HEADERS);
  const debitHit = findHeader(headers, DEBIT_HEADERS);
  const creditHit = findHeader(headers, CREDIT_HEADERS);
  const memoHit = findHeader(headers, MEMO_HEADERS);
  const relatedHit = findHeader(headers, RELATED_HEADERS);

  if (!dateHit) errors.push("Could not find a date column.");
  if (!amountHit && !debitHit && !creditHit) {
    errors.push("Could not find an amount, debit, or credit column.");
  }
  if (!memoHit) errors.push("Could not find a description/memo column.");

  if (errors.length) {
    return {
      rows: [],
      skipped: 0,
      headers,
      detected: {
        dateColumn: dateHit?.name ?? null,
        amountColumn: amountHit?.name ?? null,
        debitColumn: debitHit?.name ?? null,
        creditColumn: creditHit?.name ?? null,
        memoColumn: memoHit?.name ?? null,
        relatedColumn: relatedHit?.name ?? null,
      },
      errors,
    };
  }

  const rows: ParsedStatementRow[] = [];
  let skipped = 0;
  const keyCounts = new Map<string, number>();

  for (let r = 1; r < table.length; r++) {
    const cols = table[r]!;
    const dateRaw = cols[dateHit!.index] ?? "";
    const memoRaw = (cols[memoHit!.index] ?? "").trim() || "Imported transaction";
    const date = parseFlexibleDate(dateRaw);
    if (!date) {
      skipped += 1;
      continue;
    }

    let ledgerAmount: number | null = null;
    // Prefer a single Amount/Gross column when present (Xero Gross has correct signs).
    if (amountHit) {
      const rawAmt = parseAmount(cols[amountHit.index] ?? "");
      if (rawAmt == null) {
        skipped += 1;
        continue;
      }
      ledgerAmount =
        opts.amountConvention === "bank" ? -rawAmt : rawAmt;
    } else if (debitHit || creditHit) {
      const debit = debitHit ? parseAmount(cols[debitHit.index] ?? "") : null;
      const credit = creditHit ? parseAmount(cols[creditHit.index] ?? "") : null;
      if (debit != null && debit !== 0) ledgerAmount = -Math.abs(debit);
      else if (credit != null && credit !== 0) ledgerAmount = Math.abs(credit);
    }

    if (ledgerAmount == null || ledgerAmount === 0) {
      skipped += 1;
      continue;
    }

    // Avoid -0
    const amount = Object.is(ledgerAmount, -0) ? 0 : ledgerAmount;
    if (amount === 0) {
      skipped += 1;
      continue;
    }

    const relatedRaw = relatedHit
      ? (cols[relatedHit.index] ?? "").trim()
      : "";
    const mapped = relatedRaw ? mapXeroRelatedAccount(relatedRaw) : null;
    const type =
      mapped?.type ?? (amount > 0 ? "income" : "expense");

    const baseKey = statementImportKey(opts.accountId, date, amount, memoRaw);
    const seen = keyCounts.get(baseKey) ?? 0;
    keyCounts.set(baseKey, seen + 1);
    const importKey =
      seen === 0
        ? baseKey
        : statementImportKey(
            opts.accountId,
            date,
            amount,
            `${memoRaw}#${seen + 1}`,
          );

    rows.push({
      date,
      amount,
      type,
      memo: memoRaw.slice(0, 500),
      importKey,
      relatedAccount: relatedRaw || null,
      categorySlug: mapped?.categorySlug ?? null,
    });
  }

  return {
    rows,
    skipped,
    headers,
    detected: {
      dateColumn: dateHit?.name ?? null,
      amountColumn: amountHit?.name ?? null,
      debitColumn: debitHit?.name ?? null,
      creditColumn: creditHit?.name ?? null,
      memoColumn: memoHit?.name ?? null,
      relatedColumn: relatedHit?.name ?? null,
    },
    errors: [],
  };
}
