/**
 * Deterministic merchant → category matching for inbox auto-categorize.
 * Uses normalized merchant keys so Plaid "Amazon.com*XYZ" aligns with Xero "Amazon".
 */

export type HistoryCategoryVote = {
  categoryId: string;
  count: number;
};

export type MerchantRule = {
  /** Match if merchant key equals or starts with this (token-aware). */
  key: string;
  categorySlug: string;
  type?: "income" | "expense" | "transfer" | "tax_payment";
  confidence: number;
};

/** High-confidence personal rules when history has no vote. */
export const MERCHANT_RULES: MerchantRule[] = [
  { key: "irs", categorySlug: "tax-balance-due", type: "tax_payment", confidence: 0.95 },
  {
    key: "franchise tax",
    categorySlug: "tax-balance-due",
    type: "tax_payment",
    confidence: 0.92,
  },
  {
    key: "co dept revenue",
    categorySlug: "california-estimates",
    type: "tax_payment",
    confidence: 0.92,
  },
  {
    key: "colorado department",
    categorySlug: "california-estimates",
    type: "tax_payment",
    confidence: 0.9,
  },
  { key: "venmo", categorySlug: "transfers", type: "transfer", confidence: 0.9 },
  { key: "capital one", categorySlug: "transfers", type: "transfer", confidence: 0.9 },
  {
    key: "quicksilver",
    categorySlug: "transfers",
    type: "transfer",
    confidence: 0.9,
  },
  {
    key: "wire deposit",
    categorySlug: "consulting-income",
    type: "income",
    confidence: 0.88,
  },
  {
    key: "monthly interest",
    categorySlug: "other-income",
    type: "income",
    confidence: 0.9,
  },
  { key: "bilt", categorySlug: "sf-rent", confidence: 0.92 },
  { key: "quincy leasing", categorySlug: "sf-rent", confidence: 0.92 },
  { key: "anchor realty", categorySlug: "sf-rent", confidence: 0.9 },
  { key: "appfolio", categorySlug: "sf-rent", confidence: 0.88 },
  { key: "xcel", categorySlug: "utilities", confidence: 0.9 },
  { key: "pg", categorySlug: "utilities", confidence: 0.9 },
  { key: "comcast", categorySlug: "internet", confidence: 0.9 },
  { key: "uber eats", categorySlug: "restaurants", confidence: 0.95 },
  { key: "uber one", categorySlug: "rideshare", confidence: 0.9 },
  { key: "uber", categorySlug: "rideshare", confidence: 0.9 },
  { key: "lyft", categorySlug: "rideshare", confidence: 0.9 },
  { key: "waymo", categorySlug: "rideshare", confidence: 0.95 },
  { key: "amazon", categorySlug: "groceries", confidence: 0.85 },
  { key: "target", categorySlug: "household-supplies", confidence: 0.88 },
  { key: "netflix", categorySlug: "streaming", confidence: 0.95 },
  { key: "youtube", categorySlug: "streaming", confidence: 0.92 },
  { key: "airbnb", categorySlug: "lodging", confidence: 0.95 },
  { key: "vercel", categorySlug: "personal-software", confidence: 0.92 },
  { key: "github", categorySlug: "personal-software", confidence: 0.9 },
  { key: "neon", categorySlug: "personal-software", confidence: 0.9 },
  { key: "browserbase", categorySlug: "personal-software", confidence: 0.9 },
  { key: "better stack", categorySlug: "personal-software", confidence: 0.9 },
  { key: "apple com", categorySlug: "streaming", confidence: 0.88 },
  { key: "apple", categorySlug: "streaming", confidence: 0.85 },
  { key: "peet", categorySlug: "coffee", confidence: 0.9 },
  { key: "chestnut street", categorySlug: "coffee", confidence: 0.9 },
  { key: "simple pleasures", categorySlug: "coffee", confidence: 0.9 },
  { key: "bluestone lane", categorySlug: "coffee", confidence: 0.9 },
  { key: "shake shack", categorySlug: "restaurants", confidence: 0.95 },
  { key: "fastrak", categorySlug: "parking", confidence: 0.9 },
  { key: "impark", categorySlug: "parking", confidence: 0.9 },
  { key: "parkmobile", categorySlug: "parking", confidence: 0.9 },
  { key: "mta meter", categorySlug: "parking", confidence: 0.88 },
  { key: "tcb mta", categorySlug: "parking", confidence: 0.88 },
  { key: "linkedin", categorySlug: "news-memberships", confidence: 0.88 },
  { key: "gap", categorySlug: "clothing", confidence: 0.88 },
  { key: "abercrombie", categorySlug: "clothing", confidence: 0.9 },
  { key: "american giant", categorySlug: "clothing", confidence: 0.9 },
  { key: "ikon pass", categorySlug: "hobbies", confidence: 0.9 },
  { key: "strava", categorySlug: "fitness", confidence: 0.9 },
  { key: "surfline", categorySlug: "hobbies", confidence: 0.9 },
  { key: "crunch", categorySlug: "fitness", confidence: 0.9 },
  { key: "bodega", categorySlug: "groceries", confidence: 0.88 },
  { key: "kp", categorySlug: "health-insurance", confidence: 0.88 },
  { key: "theater", categorySlug: "entertainment", confidence: 0.86 },
  { key: "theatres", categorySlug: "entertainment", confidence: 0.86 },
  { key: "theaters", categorySlug: "entertainment", confidence: 0.86 },
  { key: "mcdonald", categorySlug: "restaurants", confidence: 0.95 },
  { key: "hbomax", categorySlug: "streaming", confidence: 0.95 },
  { key: "prime video", categorySlug: "streaming", confidence: 0.95 },
  { key: "freetaxusa", categorySlug: "tax-prep", confidence: 0.92 },
  { key: "envato", categorySlug: "personal-software", confidence: 0.88 },
  { key: "higgsfield", categorySlug: "personal-software", confidence: 0.9 },
  { key: "tonic agentic", categorySlug: "personal-software", confidence: 0.9 },
  { key: "studiosf", categorySlug: "fitness", confidence: 0.86 },
  { key: "subscription", categorySlug: "streaming", confidence: 0.85 },
  { key: "landr", categorySlug: "hobbies", confidence: 0.88 },
  { key: "corp advertising", categorySlug: "news-memberships", confidence: 0.86 },
  { key: "corp paid", categorySlug: "news-memberships", confidence: 0.86 },
];

/** Keyword heuristics for one-off merchants (still ≥ 0.85). */
const KEYWORD_HEURISTICS: {
  includes: string[];
  categorySlug: string;
  confidence: number;
}[] = [
  {
    includes: [
      "restaurant",
      "restauran",
      "taqueria",
      "burger",
      "burg",
      "luncheon",
      "tavern",
      "mcdonald",
    ],
    categorySlug: "restaurants",
    confidence: 0.86,
  },
  {
    includes: ["coffee", "cafe", "café"],
    categorySlug: "coffee",
    confidence: 0.86,
  },
  {
    includes: ["theater", "theatre", "theat"],
    categorySlug: "entertainment",
    confidence: 0.86,
  },
  {
    includes: ["market", "grocery", "foods"],
    categorySlug: "groceries",
    confidence: 0.85,
  },
  {
    includes: ["parking", "meter", "parkmobile", "impark"],
    categorySlug: "parking",
    confidence: 0.88,
  },
  {
    includes: ["workspace", "cloud", "neon", "github", "vercel"],
    categorySlug: "personal-software",
    confidence: 0.85,
  },
];

const STOP = new Set([
  "inc",
  "llc",
  "ltd",
  "com",
  "www",
  "bill",
  "payment",
  "purchase",
  "card",
  "debit",
  "credit",
  "online",
  "mktpl",
  "the",
  "and",
  "for",
  "from",
  "to",
  "acct",
  "account",
  "pos",
  "visa",
  "mc",
]);

/**
 * Stable merchant key: strip order ids / punctuation, drop noise tokens.
 * "Amazon.com*CR33F5FN3" → "amazon"
 * "Peet's Coffee & Tea" → "peet coffee tea"
 */
function tokenizeMerchant(raw: string): string[] {
  const s = raw
    .toLowerCase()
    .replace(/^(tst\*|sq\s*\*|spo\*|chk|checkcard|pos)\s*/i, "")
    .replace(/[^a-z0-9\s]/g, " ");
  const out: string[] = [];
  for (const part of s.replace(/\s+/g, " ").trim().split(" ").filter(Boolean)) {
    if (!/\d/.test(part)) {
      if (part.length >= 2 && !STOP.has(part)) out.push(part);
      continue;
    }
    // IMPARK00270155U → impark; keep letter runs ≥ 3
    for (const run of part.match(/[a-z]{3,}/g) ?? []) {
      if (!STOP.has(run)) out.push(run);
    }
  }
  return out;
}

export function merchantKey(memo: string | null | undefined): string {
  return tokenizeMerchant(memo ?? "").slice(0, 3).join(" ").slice(0, 48) || "unknown";
}

function ruleMatchesKey(key: string, ruleKey: string): boolean {
  if (key === ruleKey || key.startsWith(ruleKey + " ")) return true;
  const tokens = key.split(" ");
  const ruleTokens = ruleKey.split(" ");
  if (ruleTokens.length === 1) {
    const r = ruleTokens[0]!;
    return tokens.some((t) => t === r || t.startsWith(r));
  }
  return key.includes(ruleKey);
}

/** Back-compat alias used by agent memory fingerprints. */
export function fingerprintMemo(memo: string | null | undefined): string {
  return merchantKey(memo);
}

function keyPrefixes(key: string): string[] {
  const tokens = key.split(" ").filter(Boolean);
  const out: string[] = [];
  for (let n = tokens.length; n >= 1; n--) {
    out.push(tokens.slice(0, n).join(" "));
  }
  return out;
}

export type MerchantMatch = {
  categoryId?: string;
  categorySlug?: string;
  type?: MerchantRule["type"];
  confidence: number;
  reason: string;
  key: string;
};

/**
 * Build majority-vote index: merchant key (+ prefixes) → best categoryId.
 */
export function buildMerchantHistoryIndex(
  rows: { memo: string | null; categoryId: string }[],
): Map<string, HistoryCategoryVote> {
  const tallies = new Map<string, Map<string, number>>();

  const bump = (key: string, categoryId: string) => {
    if (!key || key === "unknown") return;
    for (const prefix of keyPrefixes(key)) {
      let m = tallies.get(prefix);
      if (!m) {
        m = new Map();
        tallies.set(prefix, m);
      }
      m.set(categoryId, (m.get(categoryId) ?? 0) + 1);
    }
  };

  for (const row of rows) {
    bump(merchantKey(row.memo), row.categoryId);
  }

  const best = new Map<string, HistoryCategoryVote>();
  for (const [key, votes] of tallies) {
    let top: HistoryCategoryVote | null = null;
    for (const [categoryId, count] of votes) {
      if (!top || count > top.count) top = { categoryId, count };
    }
    if (top && top.count >= 1) best.set(key, top);
  }
  return best;
}

/** True when memo looks like a wallet/CC payment, not a merchant purchase. */
export function looksLikeTransferMemo(memo: string | null | undefined): boolean {
  const m = (memo ?? "").toLowerCase();
  return /venmo|capital\s*one|quicksilver|xfer|transfer|wire\s+(to|from)|payment\s+thank|autopsay|credit\s*card\s*payment|bank\s*transfer/.test(
    m,
  );
}

export function matchMerchantCategory(opts: {
  memo: string | null | undefined;
  history: Map<string, HistoryCategoryVote>;
  /** slug → categoryId for rule resolution */
  slugToId: Map<string, string>;
  /** optional id → slug so history votes for Transfers can be rejected */
  idToSlug?: Map<string, string>;
  minHistoryVotes?: number;
}): MerchantMatch | null {
  const key = merchantKey(opts.memo);
  const minVotes = opts.minHistoryVotes ?? 1;
  const transferOk = looksLikeTransferMemo(opts.memo);
  const transfersId = opts.slugToId.get("transfers");

  const allow = (match: MerchantMatch): MerchantMatch | null => {
    const slug =
      match.categorySlug ??
      (match.categoryId ? opts.idToSlug?.get(match.categoryId) : undefined);
    if (
      (slug === "transfers" ||
        slug === "credit-card-payments" ||
        match.categoryId === transfersId) &&
      !transferOk
    ) {
      return null;
    }
    return match;
  };

  // Curated rules first — history from Xero/Plaid can be wrong for known merchants.
  const rules = [...MERCHANT_RULES].sort(
    (a, b) => b.key.length - a.key.length,
  );
  for (const rule of rules) {
    if (!ruleMatchesKey(key, rule.key)) continue;
    const categoryId = opts.slugToId.get(rule.categorySlug);
    if (!categoryId) continue;
    const hit = allow({
      categoryId,
      categorySlug: rule.categorySlug,
      type: rule.type,
      confidence: rule.confidence,
      reason: `Matched merchant rule "${rule.key}" → ${rule.categorySlug}.`,
      key: rule.key,
    });
    if (hit) return hit;
  }

  // Longest prefix history (uber eats before uber).
  // Skip ultra-short prefixes ("sp", "py") — too many false positives.
  for (const prefix of keyPrefixes(key)) {
    const tokens = prefix.split(" ");
    if (prefix.length < 4) continue;
    if (tokens.length === 1 && prefix.length < 5) continue;
    const vote = opts.history.get(prefix);
    if (vote && vote.count >= minVotes) {
      const confidence =
        vote.count >= 5 ? 0.95 : vote.count >= 2 ? 0.9 : 0.86;
      const hit = allow({
        categoryId: vote.categoryId,
        categorySlug: opts.idToSlug?.get(vote.categoryId),
        confidence,
        reason: `Matched merchant "${prefix}" to prior categorized history (${vote.count}×).`,
        key: prefix,
      });
      if (hit) return hit;
    }
  }

  // Keyword heuristics on the merchant key
  for (const heur of KEYWORD_HEURISTICS) {
    if (!heur.includes.some((frag) => key.includes(frag))) continue;
    const categoryId = opts.slugToId.get(heur.categorySlug);
    if (!categoryId) continue;
    const hit = allow({
      categoryId,
      categorySlug: heur.categorySlug,
      confidence: heur.confidence,
      reason: `Matched merchant keyword heuristic → ${heur.categorySlug}.`,
      key,
    });
    if (hit) return hit;
  }

  return null;
}
