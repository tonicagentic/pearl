/**
 * Map Xero "Related account" labels (from Account Transactions export)
 * onto this app's category slugs and transaction types.
 */

export type XeroRelatedMapping = {
  /** App category slug; null = leave uncategorized / no P&L line */
  categorySlug: string | null;
  /** Prefer this transaction type when set */
  type?: "income" | "expense" | "transfer" | "tax_payment";
};

/** Bank / wallet names that appear as Related account on the other side of a transfer. */
const TRANSFER_RELATED = [
  "capitalone checking",
  "360 checking",
  "quicksilver",
  "venmo bank account",
  "venmo",
  "brokerage account",
  "robinhood",
  "atm rebate checking",
  "business 2025",
];

/** Exact / prefix map: normalized related label → mapping */
const RELATED_MAP: Record<string, XeroRelatedMapping> = {
  // Income (Xero revenue codes)
  "4301 - consulting income": { categorySlug: "consulting-income", type: "income" },
  "4300 - gift": { categorySlug: "gift-income", type: "income" },
  "4715 - other income": { categorySlug: "other-income", type: "income" },

  // Housing / home
  "5201 - housing": { categorySlug: "sf-rent", type: "expense" },
  "660 - home furnishings": { categorySlug: "furniture", type: "expense" },

  // Food / leisure
  "652 - groceries": { categorySlug: "groceries", type: "expense" },
  "6200 - dining & entertainment": {
    categorySlug: "restaurants",
    type: "expense",
  },
  "661 - recreation and hobbies": { categorySlug: "hobbies", type: "expense" },

  // Transport / travel
  "6110 - transportation expense": {
    categorySlug: "rideshare",
    type: "expense",
  },
  "655 - travel": { categorySlug: "travel-activities", type: "expense" },

  // Personal
  "654 - personal care": { categorySlug: "personal-care", type: "expense" },
  "600 - clothing": { categorySlug: "clothing", type: "expense" },
  "653 - education": { categorySlug: "education", type: "expense" },

  // Subscriptions / business-ish on personal books
  "6155 - dues & subscriptions": {
    categorySlug: "streaming",
    type: "expense",
  },
  "6140 - business expenses": {
    categorySlug: "personal-software",
    type: "expense",
  },

  // Insurance / taxes / admin
  "6320 - insurance": { categorySlug: "renters-insurance", type: "expense" },
  "601 - income tax": { categorySlug: "tax-balance-due", type: "tax_payment" },
  "6040 - bank service charges": { categorySlug: "bank-fees", type: "expense" },
  "699 - interest and penalties": { categorySlug: "bank-fees", type: "expense" },
  "7050 - miscellaneous": { categorySlug: "miscellaneous", type: "expense" },
  "7150 - other expense": { categorySlug: "miscellaneous", type: "expense" },
  "657 - charitable donations": { categorySlug: "charity", type: "expense" },
};

function normalizeRelated(raw: string) {
  return raw.replace(/\s+/g, " ").trim().toLowerCase();
}

function isTransferRelated(normalized: string) {
  return TRANSFER_RELATED.some(
    (needle) =>
      normalized === needle ||
      normalized.startsWith(needle + " ") ||
      normalized.startsWith(needle + " (") ||
      normalized.includes(needle),
  );
}

/**
 * Resolve a Xero Related account string.
 * Returns null when blank / unknown (caller keeps inbox + amount-derived type).
 */
export function mapXeroRelatedAccount(
  relatedRaw: string | null | undefined,
): XeroRelatedMapping | null {
  const raw = (relatedRaw ?? "").trim();
  if (!raw) return null;

  const normalized = normalizeRelated(raw);

  if (isTransferRelated(normalized)) {
    return { categorySlug: "transfers", type: "transfer" };
  }

  if (RELATED_MAP[normalized]) return RELATED_MAP[normalized]!;

  // Code-only or "CODE - Name" fuzzy: match leading code
  const codeMatch = /^(\d{3,4})\b/.exec(normalized);
  if (codeMatch) {
    const code = codeMatch[1]!;
    for (const [key, value] of Object.entries(RELATED_MAP)) {
      if (key.startsWith(code + " ")) return value;
    }
  }

  return null;
}
