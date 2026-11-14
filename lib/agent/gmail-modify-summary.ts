import type { MailBatchItem } from "./gmail-modify-types.ts";

export function summarizeBatchForApproval(
  items: readonly MailBatchItem[],
): string {
  const byAction = new Map<string, number>();
  for (const item of items) {
    const key =
      item.action.type === "add_label" || item.action.type === "remove_label"
        ? `${item.action.type}:${item.action.labelId}`
        : item.action.type;
    byAction.set(key, (byAction.get(key) ?? 0) + 1);
  }
  const actionLines = [...byAction.entries()]
    .map(([action, count]) => `  ${action}: ${count}`)
    .join("\n");
  const sample = items
    .slice(0, 8)
    .map((item) => {
      const who = item.from?.trim() || "unknown sender";
      const subject = item.subject?.trim() || "(no subject)";
      return `  · ${who} — ${subject}`;
    })
    .join("\n");
  const accounts = [...new Set(items.map((item) => item.accountId))];
  return (
    `Apply mail changes to ${items.length} thread(s) across ${accounts.length} account(s)?\n` +
    `Actions:\n${actionLines}\n` +
    (sample ? `Sample:\n${sample}` : "")
  );
}
