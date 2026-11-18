/** Register workflow status. Cleared = reconciledAt set (bank line accepted into books). */
export type RegisterStatus = "pending" | "inbox" | "categorized" | "cleared";

/** Map legacy URL/filter values onto current statuses. */
export function normalizeRegisterStatus(
  raw: string | null | undefined,
): RegisterStatus | "" {
  if (!raw) return "";
  if (raw === "reconciled") return "cleared";
  if (raw === "unreconciled") return "categorized";
  if (
    raw === "pending" ||
    raw === "inbox" ||
    raw === "categorized" ||
    raw === "cleared"
  ) {
    return raw;
  }
  return "";
}

export function isInboxCategory(opts: {
  categoryId: string | null;
  categorySlug: string | null;
  uncategorizedId: string | null;
}) {
  return (
    !opts.categoryId ||
    opts.categoryId === opts.uncategorizedId ||
    opts.categorySlug === "uncategorized"
  );
}

export function resolveStatus(opts: {
  pending: boolean;
  categoryId: string | null;
  categorySlug: string | null;
  reconciledAt: Date | null;
  uncategorizedId: string | null;
}): RegisterStatus {
  if (opts.pending) return "pending";
  if (
    isInboxCategory({
      categoryId: opts.categoryId,
      categorySlug: opts.categorySlug,
      uncategorizedId: opts.uncategorizedId,
    })
  ) {
    return "inbox";
  }
  if (opts.reconciledAt) return "cleared";
  return "categorized";
}
