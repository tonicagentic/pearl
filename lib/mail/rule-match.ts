import type { MailRuleRow } from "@/lib/db/schema";

export type ThreadMatchInput = {
  readonly accountId: string;
  readonly from?: string | null;
  readonly listId?: string | null;
  readonly subject?: string | null;
};

function includesIgnoreCase(
  haystack: string | null | undefined,
  needle: string | null | undefined,
): boolean {
  if (!needle?.trim()) return true;
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle.trim().toLowerCase());
}

/** First matching rule for a thread, or null. */
export function matchMailRule(
  rules: readonly MailRuleRow[],
  thread: ThreadMatchInput,
): MailRuleRow | null {
  for (const rule of rules) {
    if (rule.mailAccountId && rule.mailAccountId !== thread.accountId) {
      continue;
    }
    if (!includesIgnoreCase(thread.from, rule.matchFrom)) continue;
    if (!includesIgnoreCase(thread.listId, rule.matchList)) continue;
    if (!includesIgnoreCase(thread.subject, rule.matchSubject)) continue;
    // At least one matcher must be set so an empty rule cannot match everything.
    if (!rule.matchFrom && !rule.matchList && !rule.matchSubject) continue;
    return rule;
  }
  return null;
}
