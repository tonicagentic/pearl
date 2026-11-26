/** Detect whether a turn called a Xero-style read tool (kebab or snake names). */

const XERO_READ_HINTS = [
  "list-accounts",
  "list_accounts",
  "list-bank-transactions",
  "list_bank_transactions",
  "list-bank-transfers",
  "list_bank_transfers",
  "list-profit-and-loss",
  "list_profit_and_loss",
  "list-payments",
  "list_payments",
  "list-invoices",
  "list_invoices",
  "list-manual-journals",
  "list_manual_journals",
  "list-trial-balance",
  "list_trial_balance",
  "list-balance-sheet",
  "list_balance_sheet",
  "list-organisations",
  "list_organisations",
  "list-organisation",
  "list_organisation",
  "get-organisation",
  "get_organisation",
] as const;

export function usedXeroReadTools(
  toolCalls: ReadonlyArray<{ readonly name: string }>,
): boolean {
  return toolCalls.some((call) => {
    const name = call.name.toLowerCase();
    if (name.includes("xero")) return true;
    return XERO_READ_HINTS.some(
      (hint) => name === hint || name.endsWith(`__${hint}`),
    );
  });
}
