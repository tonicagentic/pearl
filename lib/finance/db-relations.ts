// GENERATED from the legacy prisma/schema.prisma relation graph — edit by hand if the finance schema changes.
// Describes how the Prisma-compat shim (src/lib/prisma.ts) joins models for `include`, relation filters and relation orderBy.
// kind "one": at most one related row. kind "many": list.
// `local` is a column (camelCase TS property) on this model, `foreign` a column on the target model.

export type RelationDef = {
  target: string;
  kind: "one" | "many";
  local: string;
  foreign: string;
};

export const RELATIONS: Record<string, Record<string, RelationDef>> = {
  entity: {
    ownedStakes: { target: "stake", kind: "many", local: "id", foreign: "ownerEntityId" },
    heldStakes: { target: "stake", kind: "many", local: "id", foreign: "ownedEntityId" },
    accounts: { target: "account", kind: "many", local: "id", foreign: "entityId" },
    assets: { target: "asset", kind: "many", local: "id", foreign: "entityId" },
    liabilities: { target: "liability", kind: "many", local: "id", foreign: "entityId" },
    taxActivities: { target: "taxActivity", kind: "many", local: "id", foreign: "entityId" },
    taxDocumentLines: { target: "taxDocumentLine", kind: "many", local: "id", foreign: "entityId" },
    incomeSources: { target: "incomeSource", kind: "many", local: "id", foreign: "entityId" },
    transactions: { target: "transaction", kind: "many", local: "id", foreign: "entityId" },
  },
  stake: {
    ownerEntity: { target: "entity", kind: "one", local: "ownerEntityId", foreign: "id" },
    ownedEntity: { target: "entity", kind: "one", local: "ownedEntityId", foreign: "id" },
  },
  account: {
    entity: { target: "entity", kind: "one", local: "entityId", foreign: "id" },
    plaidItem: { target: "plaidItem", kind: "one", local: "plaidItemId", foreign: "id" },
    transactions: { target: "transaction", kind: "many", local: "id", foreign: "accountId" },
    assets: { target: "asset", kind: "many", local: "id", foreign: "accountId" },
    liabilities: { target: "liability", kind: "many", local: "id", foreign: "accountId" },
    taxDocuments: { target: "taxDocument", kind: "many", local: "id", foreign: "accountId" },
  },
  asset: {
    entity: { target: "entity", kind: "one", local: "entityId", foreign: "id" },
    account: { target: "account", kind: "one", local: "accountId", foreign: "id" },
    home: { target: "home", kind: "one", local: "homeId", foreign: "id" },
    vehicle: { target: "vehicle", kind: "one", local: "vehicleId", foreign: "id" },
    interests: { target: "assetInterest", kind: "many", local: "id", foreign: "assetId" },
  },
  assetInterest: {
    asset: { target: "asset", kind: "one", local: "assetId", foreign: "id" },
  },
  liability: {
    entity: { target: "entity", kind: "one", local: "entityId", foreign: "id" },
    account: { target: "account", kind: "one", local: "accountId", foreign: "id" },
  },
  categoryGroup: {
    categories: { target: "category", kind: "many", local: "id", foreign: "groupId" },
  },
  category: {
    group: { target: "categoryGroup", kind: "one", local: "groupId", foreign: "id" },
    bills: { target: "bill", kind: "many", local: "id", foreign: "categoryId" },
    transactions: { target: "transaction", kind: "many", local: "id", foreign: "categoryId" },
    budgetLines: { target: "budgetLine", kind: "many", local: "id", foreign: "categoryId" },
    incomeSources: { target: "incomeSource", kind: "many", local: "id", foreign: "categoryId" },
    homeLine: { target: "homeLine", kind: "one", local: "id", foreign: "categoryId" },
    vehicleLine: { target: "vehicleLine", kind: "one", local: "id", foreign: "categoryId" },
    healthPlans: { target: "healthPlan", kind: "many", local: "id", foreign: "categoryId" },
    prescriptions: { target: "prescription", kind: "many", local: "id", foreign: "categoryId" },
    appointments: { target: "appointment", kind: "many", local: "id", foreign: "categoryId" },
    visionSupplies: { target: "visionSupply", kind: "many", local: "id", foreign: "categoryId" },
    recurringSeries: { target: "recurringSeries", kind: "many", local: "id", foreign: "categoryId" },
    tripLines: { target: "tripLine", kind: "many", local: "id", foreign: "categoryId" },
    agentInsights: { target: "agentInsight", kind: "many", local: "id", foreign: "categoryId" },
    categoryMemory: { target: "agentCategoryMemory", kind: "many", local: "id", foreign: "categoryId" },
  },
  agentInsight: {
    category: { target: "category", kind: "one", local: "categoryId", foreign: "id" },
  },
  agentCategoryMemory: {
    category: { target: "category", kind: "one", local: "categoryId", foreign: "id" },
  },
  healthPlan: {
    category: { target: "category", kind: "one", local: "categoryId", foreign: "id" },
    bill: { target: "bill", kind: "one", local: "billId", foreign: "id" },
    benefits: { target: "healthPlanBenefit", kind: "many", local: "id", foreign: "planId" },
    appointments: { target: "appointment", kind: "many", local: "id", foreign: "healthPlanId" },
    prescriptions: { target: "prescription", kind: "many", local: "id", foreign: "healthPlanId" },
    recurringSeries: { target: "recurringSeries", kind: "many", local: "id", foreign: "healthPlanId" },
  },
  healthPlanBenefit: {
    plan: { target: "healthPlan", kind: "one", local: "planId", foreign: "id" },
  },
  prescription: {
    category: { target: "category", kind: "one", local: "categoryId", foreign: "id" },
    bill: { target: "bill", kind: "one", local: "billId", foreign: "id" },
    healthPlan: { target: "healthPlan", kind: "one", local: "healthPlanId", foreign: "id" },
  },
  recurringSeries: {
    category: { target: "category", kind: "one", local: "categoryId", foreign: "id" },
    bill: { target: "bill", kind: "one", local: "billId", foreign: "id" },
    healthPlan: { target: "healthPlan", kind: "one", local: "healthPlanId", foreign: "id" },
    appointments: { target: "appointment", kind: "many", local: "id", foreign: "seriesId" },
  },
  appointment: {
    category: { target: "category", kind: "one", local: "categoryId", foreign: "id" },
    healthPlan: { target: "healthPlan", kind: "one", local: "healthPlanId", foreign: "id" },
    series: { target: "recurringSeries", kind: "one", local: "seriesId", foreign: "id" },
  },
  visionSupply: {
    category: { target: "category", kind: "one", local: "categoryId", foreign: "id" },
    bill: { target: "bill", kind: "one", local: "billId", foreign: "id" },
  },
  home: {
    lines: { target: "homeLine", kind: "many", local: "id", foreign: "homeId" },
    asset: { target: "asset", kind: "one", local: "id", foreign: "homeId" },
    trips: { target: "trip", kind: "many", local: "id", foreign: "homeId" },
    tripLegs: { target: "tripLeg", kind: "many", local: "id", foreign: "homeId" },
    tripNightStays: { target: "tripNightStay", kind: "many", local: "id", foreign: "homeId" },
  },
  homeLine: {
    home: { target: "home", kind: "one", local: "homeId", foreign: "id" },
    category: { target: "category", kind: "one", local: "categoryId", foreign: "id" },
    bill: { target: "bill", kind: "one", local: "billId", foreign: "id" },
  },
  vehicle: {
    lines: { target: "vehicleLine", kind: "many", local: "id", foreign: "vehicleId" },
    asset: { target: "asset", kind: "one", local: "id", foreign: "vehicleId" },
    registrationBill: { target: "bill", kind: "one", local: "registrationBillId", foreign: "id" },
    insuranceBill: { target: "bill", kind: "one", local: "insuranceBillId", foreign: "id" },
  },
  vehicleLine: {
    vehicle: { target: "vehicle", kind: "one", local: "vehicleId", foreign: "id" },
    category: { target: "category", kind: "one", local: "categoryId", foreign: "id" },
  },
  trip: {
    lines: { target: "tripLine", kind: "many", local: "id", foreign: "tripId" },
    options: { target: "tripOption", kind: "many", local: "id", foreign: "tripId" },
    legs: { target: "tripLeg", kind: "many", local: "id", foreign: "tripId" },
    dayItems: { target: "tripDayItem", kind: "many", local: "id", foreign: "tripId" },
    nightStays: { target: "tripNightStay", kind: "many", local: "id", foreign: "tripId" },
    transactions: { target: "transaction", kind: "many", local: "id", foreign: "tripId" },
    home: { target: "home", kind: "one", local: "homeId", foreign: "id" },
  },
  tripDayItem: {
    trip: { target: "trip", kind: "one", local: "tripId", foreign: "id" },
  },
  tripNightStay: {
    trip: { target: "trip", kind: "one", local: "tripId", foreign: "id" },
    home: { target: "home", kind: "one", local: "homeId", foreign: "id" },
  },
  tripLeg: {
    trip: { target: "trip", kind: "one", local: "tripId", foreign: "id" },
    home: { target: "home", kind: "one", local: "homeId", foreign: "id" },
  },
  tripLine: {
    trip: { target: "trip", kind: "one", local: "tripId", foreign: "id" },
    category: { target: "category", kind: "one", local: "categoryId", foreign: "id" },
    options: { target: "tripOption", kind: "many", local: "id", foreign: "tripLineId" },
  },
  tripOption: {
    trip: { target: "trip", kind: "one", local: "tripId", foreign: "id" },
    tripLine: { target: "tripLine", kind: "one", local: "tripLineId", foreign: "id" },
  },
  bill: {
    category: { target: "category", kind: "one", local: "categoryId", foreign: "id" },
    transactions: { target: "transaction", kind: "many", local: "id", foreign: "billId" },
    registrationVehicle: { target: "vehicle", kind: "one", local: "id", foreign: "registrationBillId" },
    insuranceVehicle: { target: "vehicle", kind: "one", local: "id", foreign: "insuranceBillId" },
    prescription: { target: "prescription", kind: "one", local: "id", foreign: "billId" },
    visionSupply: { target: "visionSupply", kind: "one", local: "id", foreign: "billId" },
    recurringSeries: { target: "recurringSeries", kind: "one", local: "id", foreign: "billId" },
    homeLine: { target: "homeLine", kind: "one", local: "id", foreign: "billId" },
    healthPlan: { target: "healthPlan", kind: "one", local: "id", foreign: "billId" },
  },
  transaction: {
    account: { target: "account", kind: "one", local: "accountId", foreign: "id" },
    entity: { target: "entity", kind: "one", local: "entityId", foreign: "id" },
    category: { target: "category", kind: "one", local: "categoryId", foreign: "id" },
    bill: { target: "bill", kind: "one", local: "billId", foreign: "id" },
    trip: { target: "trip", kind: "one", local: "tripId", foreign: "id" },
  },
  incomeSource: {
    entity: { target: "entity", kind: "one", local: "entityId", foreign: "id" },
    category: { target: "category", kind: "one", local: "categoryId", foreign: "id" },
  },
  budget: {
    lines: { target: "budgetLine", kind: "many", local: "id", foreign: "budgetId" },
  },
  budgetLine: {
    budget: { target: "budget", kind: "one", local: "budgetId", foreign: "id" },
    category: { target: "category", kind: "one", local: "categoryId", foreign: "id" },
  },
  taxBusinessExpense: {
    activity: { target: "taxActivity", kind: "one", local: "activityId", foreign: "id" },
  },
  taxActivity: {
    entity: { target: "entity", kind: "one", local: "entityId", foreign: "id" },
    expensesDetail: { target: "taxBusinessExpense", kind: "many", local: "id", foreign: "activityId" },
  },
  taxDocument: {
    account: { target: "account", kind: "one", local: "accountId", foreign: "id" },
    lines: { target: "taxDocumentLine", kind: "many", local: "id", foreign: "documentId" },
  },
  taxDocumentLine: {
    document: { target: "taxDocument", kind: "one", local: "documentId", foreign: "id" },
    entity: { target: "entity", kind: "one", local: "entityId", foreign: "id" },
  },
  plaidItem: {
    accounts: { target: "account", kind: "many", local: "id", foreign: "plaidItemId" },
  },
};

/** Type-level mirror of RELATIONS, used to type include/select results. */
export type RelationTypes = {
  entity: {
    ownedStakes: { target: "stake"; many: true; optional: false };
    heldStakes: { target: "stake"; many: true; optional: false };
    accounts: { target: "account"; many: true; optional: false };
    assets: { target: "asset"; many: true; optional: false };
    liabilities: { target: "liability"; many: true; optional: false };
    taxActivities: { target: "taxActivity"; many: true; optional: false };
    taxDocumentLines: { target: "taxDocumentLine"; many: true; optional: false };
    incomeSources: { target: "incomeSource"; many: true; optional: false };
    transactions: { target: "transaction"; many: true; optional: false };
  };
  stake: {
    ownerEntity: { target: "entity"; many: false; optional: false };
    ownedEntity: { target: "entity"; many: false; optional: false };
  };
  account: {
    entity: { target: "entity"; many: false; optional: false };
    plaidItem: { target: "plaidItem"; many: false; optional: true };
    transactions: { target: "transaction"; many: true; optional: false };
    assets: { target: "asset"; many: true; optional: false };
    liabilities: { target: "liability"; many: true; optional: false };
    taxDocuments: { target: "taxDocument"; many: true; optional: false };
  };
  asset: {
    entity: { target: "entity"; many: false; optional: false };
    account: { target: "account"; many: false; optional: true };
    home: { target: "home"; many: false; optional: true };
    vehicle: { target: "vehicle"; many: false; optional: true };
    interests: { target: "assetInterest"; many: true; optional: false };
  };
  assetInterest: {
    asset: { target: "asset"; many: false; optional: false };
  };
  liability: {
    entity: { target: "entity"; many: false; optional: false };
    account: { target: "account"; many: false; optional: true };
  };
  categoryGroup: {
    categories: { target: "category"; many: true; optional: false };
  };
  category: {
    group: { target: "categoryGroup"; many: false; optional: false };
    bills: { target: "bill"; many: true; optional: false };
    transactions: { target: "transaction"; many: true; optional: false };
    budgetLines: { target: "budgetLine"; many: true; optional: false };
    incomeSources: { target: "incomeSource"; many: true; optional: false };
    homeLine: { target: "homeLine"; many: false; optional: true };
    vehicleLine: { target: "vehicleLine"; many: false; optional: true };
    healthPlans: { target: "healthPlan"; many: true; optional: false };
    prescriptions: { target: "prescription"; many: true; optional: false };
    appointments: { target: "appointment"; many: true; optional: false };
    visionSupplies: { target: "visionSupply"; many: true; optional: false };
    recurringSeries: { target: "recurringSeries"; many: true; optional: false };
    tripLines: { target: "tripLine"; many: true; optional: false };
    agentInsights: { target: "agentInsight"; many: true; optional: false };
    categoryMemory: { target: "agentCategoryMemory"; many: true; optional: false };
  };
  agentInsight: {
    category: { target: "category"; many: false; optional: true };
  };
  agentCategoryMemory: {
    category: { target: "category"; many: false; optional: false };
  };
  healthPlan: {
    category: { target: "category"; many: false; optional: false };
    bill: { target: "bill"; many: false; optional: true };
    benefits: { target: "healthPlanBenefit"; many: true; optional: false };
    appointments: { target: "appointment"; many: true; optional: false };
    prescriptions: { target: "prescription"; many: true; optional: false };
    recurringSeries: { target: "recurringSeries"; many: true; optional: false };
  };
  healthPlanBenefit: {
    plan: { target: "healthPlan"; many: false; optional: false };
  };
  prescription: {
    category: { target: "category"; many: false; optional: false };
    bill: { target: "bill"; many: false; optional: true };
    healthPlan: { target: "healthPlan"; many: false; optional: true };
  };
  recurringSeries: {
    category: { target: "category"; many: false; optional: false };
    bill: { target: "bill"; many: false; optional: true };
    healthPlan: { target: "healthPlan"; many: false; optional: true };
    appointments: { target: "appointment"; many: true; optional: false };
  };
  appointment: {
    category: { target: "category"; many: false; optional: false };
    healthPlan: { target: "healthPlan"; many: false; optional: true };
    series: { target: "recurringSeries"; many: false; optional: true };
  };
  visionSupply: {
    category: { target: "category"; many: false; optional: false };
    bill: { target: "bill"; many: false; optional: true };
  };
  home: {
    lines: { target: "homeLine"; many: true; optional: false };
    asset: { target: "asset"; many: false; optional: true };
    trips: { target: "trip"; many: true; optional: false };
    tripLegs: { target: "tripLeg"; many: true; optional: false };
    tripNightStays: { target: "tripNightStay"; many: true; optional: false };
  };
  homeLine: {
    home: { target: "home"; many: false; optional: false };
    category: { target: "category"; many: false; optional: false };
    bill: { target: "bill"; many: false; optional: true };
  };
  vehicle: {
    lines: { target: "vehicleLine"; many: true; optional: false };
    asset: { target: "asset"; many: false; optional: true };
    registrationBill: { target: "bill"; many: false; optional: true };
    insuranceBill: { target: "bill"; many: false; optional: true };
  };
  vehicleLine: {
    vehicle: { target: "vehicle"; many: false; optional: false };
    category: { target: "category"; many: false; optional: false };
  };
  trip: {
    lines: { target: "tripLine"; many: true; optional: false };
    options: { target: "tripOption"; many: true; optional: false };
    legs: { target: "tripLeg"; many: true; optional: false };
    dayItems: { target: "tripDayItem"; many: true; optional: false };
    nightStays: { target: "tripNightStay"; many: true; optional: false };
    transactions: { target: "transaction"; many: true; optional: false };
    home: { target: "home"; many: false; optional: true };
  };
  tripDayItem: {
    trip: { target: "trip"; many: false; optional: false };
  };
  tripNightStay: {
    trip: { target: "trip"; many: false; optional: false };
    home: { target: "home"; many: false; optional: true };
  };
  tripLeg: {
    trip: { target: "trip"; many: false; optional: false };
    home: { target: "home"; many: false; optional: true };
  };
  tripLine: {
    trip: { target: "trip"; many: false; optional: false };
    category: { target: "category"; many: false; optional: false };
    options: { target: "tripOption"; many: true; optional: false };
  };
  tripOption: {
    trip: { target: "trip"; many: false; optional: false };
    tripLine: { target: "tripLine"; many: false; optional: true };
  };
  bill: {
    category: { target: "category"; many: false; optional: false };
    transactions: { target: "transaction"; many: true; optional: false };
    registrationVehicle: { target: "vehicle"; many: false; optional: true };
    insuranceVehicle: { target: "vehicle"; many: false; optional: true };
    prescription: { target: "prescription"; many: false; optional: true };
    visionSupply: { target: "visionSupply"; many: false; optional: true };
    recurringSeries: { target: "recurringSeries"; many: false; optional: true };
    homeLine: { target: "homeLine"; many: false; optional: true };
    healthPlan: { target: "healthPlan"; many: false; optional: true };
  };
  transaction: {
    account: { target: "account"; many: false; optional: false };
    entity: { target: "entity"; many: false; optional: false };
    category: { target: "category"; many: false; optional: true };
    bill: { target: "bill"; many: false; optional: true };
    trip: { target: "trip"; many: false; optional: true };
  };
  incomeSource: {
    entity: { target: "entity"; many: false; optional: true };
    category: { target: "category"; many: false; optional: true };
  };
  budget: {
    lines: { target: "budgetLine"; many: true; optional: false };
  };
  budgetLine: {
    budget: { target: "budget"; many: false; optional: false };
    category: { target: "category"; many: false; optional: false };
  };
  taxBusinessExpense: {
    activity: { target: "taxActivity"; many: false; optional: false };
  };
  taxActivity: {
    entity: { target: "entity"; many: false; optional: false };
    expensesDetail: { target: "taxBusinessExpense"; many: true; optional: false };
  };
  taxDocument: {
    account: { target: "account"; many: false; optional: true };
    lines: { target: "taxDocumentLine"; many: true; optional: false };
  };
  taxDocumentLine: {
    document: { target: "taxDocument"; many: false; optional: false };
    entity: { target: "entity"; many: false; optional: true };
  };
  plaidItem: {
    accounts: { target: "account"; many: true; optional: false };
  };
};
