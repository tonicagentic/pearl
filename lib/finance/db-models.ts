import type { PgTable } from "drizzle-orm/pg-core";
import * as s from "@/lib/finance/db/schema";

/**
 * Prisma model delegate name -> Drizzle table (Pearl `finance` schema).
 * Keep in sync with the exports of src/db/schema/finance.ts.
 */
export const MODEL_TABLES = {
  entity: s.financeEntities,
  account: s.financeAccounts,
  bill: s.financeBills,
  transaction: s.financeTransactions,
  home: s.financeHomes,
  vehicle: s.financeVehicles,
  trip: s.financeTrips,
  category: s.financeCategories,
  categoryGroup: s.financeCategoryGroups,
  taxProfile: s.financeTaxProfiles,
  taxYearProfile: s.financeTaxYearProfiles,
  taxActivity: s.financeTaxActivities,
  taxEvent: s.financeTaxEvents,
  taxCapitalGain: s.financeTaxCapitalGains,
  taxDocument: s.financeTaxDocuments,
  taxDocumentLine: s.financeTaxDocumentLines,
  taxBusinessExpense: s.financeTaxBusinessExpenses,
  taxYearParams: s.financeTaxYearParams,
  plaidItem: s.financePlaidItems,
  asset: s.financeAssets,
  assetInterest: s.financeAssetInterests,
  liability: s.financeLiabilities,
  stake: s.financeStakes,
  incomeSource: s.financeIncomeSources,
  budget: s.financeBudgets,
  budgetLine: s.financeBudgetLines,
  healthPlan: s.financeHealthPlans,
  healthPlanBenefit: s.financeHealthPlanBenefits,
  prescription: s.financePrescriptions,
  appointment: s.financeAppointments,
  visionSupply: s.financeVisionSupplies,
  recurringSeries: s.financeRecurringSeries,
  homeLine: s.financeHomeLines,
  vehicleLine: s.financeVehicleLines,
  tripLine: s.financeTripLines,
  tripLeg: s.financeTripLegs,
  tripDayItem: s.financeTripDayItems,
  tripNightStay: s.financeTripNightStays,
  tripOption: s.financeTripOptions,
  personalDocument: s.financePersonalDocuments,
  agentInsight: s.financeAgentInsights,
  agentCategoryMemory: s.financeAgentCategoryMemory,
  futurePlan: s.financeFuturePlans,
} as const satisfies Record<string, PgTable>;

export type ModelName = keyof typeof MODEL_TABLES;

export function isModelName(name: string): name is ModelName {
  return Object.prototype.hasOwnProperty.call(MODEL_TABLES, name);
}

/**
 * Legacy Prisma field -> Drizzle column property. Secrets are now stored as
 * `*Enc` ciphertext columns. Until the encrypt-on-write todo lands the shim only
 * renames the field (plaintext in, same value out); reads expose BOTH names.
 */
export const FIELD_ALIASES: Partial<Record<ModelName, Record<string, string>>> = {
  personalDocument: { identifier: "identifierEnc" },
  vehicle: { insurancePolicyNumber: "insurancePolicyNumberEnc" },
};
