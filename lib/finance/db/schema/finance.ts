import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  numeric,
  pgSchema,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { user } from "./auth-stub";

/**
 * Pearl Money ledger (ported from the Pearl Money Prisma/SQLite schema).
 *
 * - Lives in the dedicated `finance` Postgres schema, so table names such as
 *   `homes`, `vehicles`, `prescriptions` and `trips` don't collide with the
 *   existing `public.*` Pearl tables. All TS exports are prefixed with
 *   `finance` for the same reason (`export *` from db/schema/index.ts).
 * - Every table carries `user_id` (FK -> public.user, cascade) so row-level
 *   security can be enforced without joins (see drizzle/0001_finance_schema.sql).
 * - Primary keys are `text` so ids from the SQLite import can be preserved.
 * - Money is `numeric(14, 2)`; ratios / percents / rates stay double precision.
 * - Secrets are stored only as ciphertext in `*_enc` text columns.
 */
export const finance = pgSchema("finance");

// --- Column helpers (builders must be fresh per column) ---

const id = () =>
  text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()::text`);

const userId = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

const money = (name: string) => numeric(name, { precision: 14, scale: 2 });

const createdAt = () => timestamp("created_at").defaultNow().notNull();

const updatedAt = () =>
  timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull();

// --- Ownership ---

export const financeEntities = finance.table(
  "entities",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    taxClass: text("tax_class").notNull(), // individual | disregarded | partnership | s_corp | c_corp
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("entities_user_slug_unique").on(t.userId, t.slug)]
);

export const financeStakes = finance.table(
  "stakes",
  {
    id: id(),
    userId: userId(),
    ownerEntityId: text("owner_entity_id")
      .notNull()
      .references(() => financeEntities.id),
    ownedEntityId: text("owned_entity_id")
      .notNull()
      .references(() => financeEntities.id),
    percent: doublePrecision("percent").notNull(), // 0-100 economic ownership
    validFrom: timestamp("valid_from").defaultNow().notNull(),
    validTo: timestamp("valid_to"),
    notes: text("notes"),
  },
  (t) => [
    index("stakes_user_id_idx").on(t.userId),
    index("stakes_owner_entity_id_idx").on(t.ownerEntityId),
    index("stakes_owned_entity_id_idx").on(t.ownedEntityId),
  ]
);

// --- Connections ---

export const financePlaidItems = finance.table(
  "plaid_items",
  {
    id: id(),
    userId: userId(),
    itemId: text("item_id").notNull(),
    accessTokenEnc: text("access_token_enc").notNull(), // ciphertext only
    institutionId: text("institution_id"),
    institutionName: text("institution_name"),
    cursor: text("cursor"),
    status: text("status").notNull().default("active"),
    /** Last successful `/transactions/refresh` (null if never / unsupported). */
    lastRefreshedAt: timestamp("last_refreshed_at"),
    /** Last successful `/transactions/sync` that finished cleanly. */
    lastSyncedAt: timestamp("last_synced_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("plaid_items_user_item_unique").on(t.userId, t.itemId)]
);

// --- Accounts & balance sheet ---

export const financeAccounts = finance.table(
  "accounts",
  {
    id: id(),
    userId: userId(),
    entityId: text("entity_id")
      .notNull()
      .references(() => financeEntities.id),
    name: text("name").notNull(),
    type: text("type").notNull(), // bank | credit | loan | brokerage
    source: text("source").notNull().default("manual"), // manual | plaid | xero
    currency: text("currency").notNull().default("USD"),
    balance: money("balance").notNull().default("0"),
    balanceAsOf: timestamp("balance_as_of").defaultNow().notNull(),
    plaidAccountId: text("plaid_account_id"),
    plaidItemId: text("plaid_item_id").references(() => financePlaidItems.id, {
      onDelete: "set null",
    }),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("accounts_user_id_idx").on(t.userId),
    index("accounts_entity_id_idx").on(t.entityId),
    index("accounts_plaid_item_id_idx").on(t.plaidItemId),
  ]
);

// --- Chart of accounts / categories ---

export const financeCategoryGroups = finance.table(
  "category_groups",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    kind: text("kind").notNull(), // lifestyle | cash_only | inbox
    code: text("code"), // CoA-style group code e.g. 5100
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [unique("category_groups_user_slug_unique").on(t.userId, t.slug)]
);

export const financeCategories = finance.table(
  "categories",
  {
    id: id(),
    userId: userId(),
    groupId: text("group_id")
      .notNull()
      .references(() => financeCategoryGroups.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    code: text("code"), // CoA-style account code e.g. 5101
    sortOrder: integer("sort_order").notNull().default(0),
    isArchived: boolean("is_archived").notNull().default(false),
    taxHint: text("tax_hint"), // self_employed_health | retirement | none
    notes: text("notes"),
  },
  (t) => [
    unique("categories_user_slug_unique").on(t.userId, t.slug),
    index("categories_group_id_idx").on(t.groupId),
  ]
);

// --- Bills (amounts you pay: rent, subscriptions, etc.) ---

export const financeBills = finance.table(
  "bills",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    categoryId: text("category_id")
      .notNull()
      .references(() => financeCategories.id),
    amount: money("amount").notNull().default("0"), // monthly-equivalent via cadence
    cadence: text("cadence").notNull().default("monthly"), // monthly | annual | weekly | one_time | semi_annual
    isActive: boolean("is_active").notNull().default(true),
    nextDate: timestamp("next_date"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("bills_user_id_idx").on(t.userId),
    index("bills_category_id_idx").on(t.categoryId),
  ]
);

// --- Homes (organize housing budget by place) ---

export const financeHomes = finance.table(
  "homes",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    occupancy: text("occupancy").notNull().default("rent"), // rent | own | use
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    region: text("region"),
    postalCode: text("postal_code"),
    estimatedValue: money("estimated_value"),
    estimatedValueSource: text("estimated_value_source"),
    estimatedValueAt: timestamp("estimated_value_at"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("homes_user_slug_unique").on(t.userId, t.slug)]
);

// --- Vehicles (organize car budget by vehicle) ---

export const financeVehicles = finance.table(
  "vehicles",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ownership: text("ownership").notNull().default("own"), // own | lease | borrow
    make: text("make"),
    model: text("model"),
    year: integer("year"),
    estimatedValue: money("estimated_value"),
    estimatedValueSource: text("estimated_value_source"),
    estimatedValueAt: timestamp("estimated_value_at"),
    milesPerMonth: doublePrecision("miles_per_month"),
    estimatedMpg: doublePrecision("estimated_mpg"),
    // Per-gallon price needs more than 2 decimals (e.g. 3.459)
    gasPricePerGallon: numeric("gas_price_per_gallon", { precision: 8, scale: 4 }),
    fuelEstimateMonthly: money("fuel_estimate_monthly"),
    registeredLine1: text("registered_line1"),
    registeredLine2: text("registered_line2"),
    registeredCity: text("registered_city"),
    registeredRegion: text("registered_region"), // e.g. CA
    registrationRenewsOn: timestamp("registration_renews_on"),
    registrationAmount: money("registration_amount"),
    registrationBillId: text("registration_bill_id")
      .unique()
      .references(() => financeBills.id, { onDelete: "set null" }),
    insuranceCarrier: text("insurance_carrier"),
    insurancePolicyNumberEnc: text("insurance_policy_number_enc"), // ciphertext only
    insuranceAmount: money("insurance_amount"),
    insuranceCadence: text("insurance_cadence").notNull().default("monthly"), // monthly | semi_annual | annual
    insuranceRenewsOn: timestamp("insurance_renews_on"),
    insuranceBillId: text("insurance_bill_id")
      .unique()
      .references(() => financeBills.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("vehicles_user_slug_unique").on(t.userId, t.slug)]
);

// --- Assets & liabilities ---

export const financeAssets = finance.table(
  "assets",
  {
    id: id(),
    userId: userId(),
    entityId: text("entity_id")
      .notNull()
      .references(() => financeEntities.id),
    accountId: text("account_id").references(() => financeAccounts.id, {
      onDelete: "set null",
    }), // linked brokerage/bank for market value
    homeId: text("home_id")
      .unique()
      .references(() => financeHomes.id, { onDelete: "cascade" }), // owned home mirrored onto balance sheet
    vehicleId: text("vehicle_id")
      .unique()
      .references(() => financeVehicles.id, { onDelete: "cascade" }), // owned vehicle mirrored onto balance sheet
    name: text("name").notNull(),
    type: text("type").notNull(), // cash | investment | real_estate | vehicle | private | other
    value: money("value").notNull().default("0"),
    costBasis: money("cost_basis"),
    valueAsOf: timestamp("value_as_of").defaultNow().notNull(),
    isBackdrop: boolean("is_backdrop").notNull().default(false),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("assets_user_id_idx").on(t.userId),
    index("assets_entity_id_idx").on(t.entityId),
    index("assets_account_id_idx").on(t.accountId),
  ]
);

export const financeAssetInterests = finance.table(
  "asset_interests",
  {
    id: id(),
    userId: userId(),
    assetId: text("asset_id")
      .notNull()
      .references(() => financeAssets.id, { onDelete: "cascade" }),
    ownerName: text("owner_name").notNull(), // person or entity label
    entityId: text("entity_id").references(() => financeEntities.id, {
      onDelete: "set null",
    }), // if one of your entities
    percent: doublePrecision("percent").notNull(),
    notes: text("notes"),
  },
  (t) => [
    index("asset_interests_user_id_idx").on(t.userId),
    index("asset_interests_asset_id_idx").on(t.assetId),
  ]
);

export const financeLiabilities = finance.table(
  "liabilities",
  {
    id: id(),
    userId: userId(),
    entityId: text("entity_id")
      .notNull()
      .references(() => financeEntities.id),
    accountId: text("account_id").references(() => financeAccounts.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    type: text("type").notNull(), // credit_card | mortgage | loan | private_note | tax | other
    balance: money("balance").notNull().default("0"),
    balanceAsOf: timestamp("balance_as_of").defaultNow().notNull(),
    interestRate: doublePrecision("interest_rate"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("liabilities_user_id_idx").on(t.userId),
    index("liabilities_entity_id_idx").on(t.entityId),
    index("liabilities_account_id_idx").on(t.accountId),
  ]
);

// --- Coach / Eve agent insights & category memory ---

export const financeAgentInsights = finance.table(
  "agent_insights",
  {
    id: id(),
    userId: userId(),
    kind: text("kind").notNull(), // budget_gap | savings | category_suggest | run_summary
    title: text("title").notNull(),
    body: text("body").notNull(),
    categoryId: text("category_id").references(() => financeCategories.id, {
      onDelete: "set null",
    }),
    payload: text("payload").notNull().default("{}"), // JSON
    confidence: doublePrecision("confidence").notNull().default(0),
    status: text("status").notNull().default("proposed"), // proposed | applied | dismissed
    appliedAt: timestamp("applied_at"),
    runId: text("run_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("agent_insights_user_status_created_idx").on(t.userId, t.status, t.createdAt),
    index("agent_insights_kind_idx").on(t.kind),
    index("agent_insights_category_id_idx").on(t.categoryId),
  ]
);

export const financeAgentCategoryMemory = finance.table(
  "agent_category_memory",
  {
    id: id(),
    userId: userId(),
    fingerprint: text("fingerprint").notNull(),
    categoryId: text("category_id")
      .notNull()
      .references(() => financeCategories.id),
    hitCount: integer("hit_count").notNull().default(1),
    lastConfidence: doublePrecision("last_confidence").notNull().default(0),
    sampleMemo: text("sample_memo"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("agent_category_memory_user_fingerprint_unique").on(t.userId, t.fingerprint),
    index("agent_category_memory_category_id_idx").on(t.categoryId),
  ]
);

// --- Health plans (year-scoped; premiums feed SE deduction + budget) ---

export const financeHealthPlans = finance.table(
  "health_plans",
  {
    id: id(),
    userId: userId(),
    year: integer("year").notNull(),
    coverageType: text("coverage_type").notNull().default("medical"), // medical | dental | vision
    carrier: text("carrier").notNull(),
    planName: text("plan_name").notNull(),
    metalTier: text("metal_tier"), // bronze | silver | gold | platinum | catastrophic | other
    premiumMonthly: money("premium_monthly").notNull().default("0"),
    deductible: money("deductible"), // individual in-network
    oopMax: money("oop_max"), // individual in-network
    deductibleFamily: money("deductible_family"),
    oopMaxFamily: money("oop_max_family"),
    hsaEligible: boolean("hsa_eligible").notNull().default(false),
    coverageStart: timestamp("coverage_start"),
    coverageEnd: timestamp("coverage_end"),
    enrollmentKind: text("enrollment_kind").notNull().default("open"), // open | special
    qualifyingEvent: text("qualifying_event"), // lost_coverage | household_change | move | medicaid_chip | employer_change | other
    qualifyingEventDate: timestamp("qualifying_event_date"),
    // Accumulator progress for this coverage period (resets with the period)
    deductibleUsed: money("deductible_used").notNull().default("0"),
    oopUsed: money("oop_used").notNull().default("0"),
    deductibleUsedFamily: money("deductible_used_family").notNull().default("0"),
    oopUsedFamily: money("oop_used_family").notNull().default("0"),
    accumulatorScope: text("accumulator_scope").notNull().default("individual"), // individual | family
    // SBC upload + review (medical plans)
    sbcBlobUrl: text("sbc_blob_url"),
    sbcFileName: text("sbc_file_name"),
    sbcStatus: text("sbc_status").notNull().default("none"), // none | pending_review | confirmed
    sbcCoverageStart: timestamp("sbc_coverage_start"),
    sbcCoverageEnd: timestamp("sbc_coverage_end"),
    formularyUrl: text("formulary_url"),
    exclusionsJson: text("exclusions_json"), // JSON string[]
    benefitsConfirmedAt: timestamp("benefits_confirmed_at"),
    categoryId: text("category_id")
      .notNull()
      .references(() => financeCategories.id), // health/dental/vision insurance CoA
    premiumNextDate: timestamp("premium_next_date"), // next premium due (synced Bill)
    billId: text("bill_id")
      .unique()
      .references(() => financeBills.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("health_plans_user_year_idx").on(t.userId, t.year),
    index("health_plans_category_id_idx").on(t.categoryId),
    index("health_plans_coverage_start_idx").on(t.coverageStart),
    index("health_plans_coverage_end_idx").on(t.coverageEnd),
  ]
);

export const financeHealthPlanBenefits = finance.table(
  "health_plan_benefits",
  {
    id: id(),
    userId: userId(),
    planId: text("plan_id")
      .notNull()
      .references(() => financeHealthPlans.id, { onDelete: "cascade" }),
    serviceKey: text("service_key").notNull(), // see src/lib/sbc/catalog.ts
    network: text("network").notNull().default("in_network"), // in_network | out_of_network | middle
    rawText: text("raw_text").notNull().default(""),
    ruleKind: text("rule_kind").notNull().default("unknown"), // copay | coinsurance | no_charge | not_covered | unknown
    // Dollar copay or coinsurance rate; 4 decimals so rates like 0.125 survive
    amount: numeric("amount", { precision: 14, scale: 4 }),
    unit: text("unit"), // visit | prescription | day | stay
    deductibleApplies: boolean("deductible_applies"),
    channel: text("channel"), // retail | mail | null (both / unspecified)
    limitations: text("limitations"),
    confirmed: boolean("confirmed").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("health_plan_benefits_user_id_idx").on(t.userId),
    index("health_plan_benefits_plan_id_idx").on(t.planId),
    index("health_plan_benefits_service_key_idx").on(t.serviceKey),
    unique("health_plan_benefits_plan_service_network_channel_unique").on(
      t.planId,
      t.serviceKey,
      t.network,
      t.channel
    ),
  ]
);

// --- Prescriptions (recurring Rx costs; optional Bill sync) ---

export const financePrescriptions = finance.table(
  "prescriptions",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    pharmacy: text("pharmacy"),
    rxNumber: text("rx_number"),
    prescriber: text("prescriber"),
    amount: money("amount").notNull().default("0"),
    cadence: text("cadence").notNull().default("monthly"), // monthly | quarterly | as_needed
    nextRefillDate: timestamp("next_refill_date"),
    isActive: boolean("is_active").notNull().default(true),
    categoryId: text("category_id")
      .notNull()
      .references(() => financeCategories.id),
    billId: text("bill_id")
      .unique()
      .references(() => financeBills.id, { onDelete: "set null" }),
    healthPlanId: text("health_plan_id").references(() => financeHealthPlans.id, {
      onDelete: "set null",
    }),
    drugTierKey: text("drug_tier_key"), // generic_drugs | preferred_brand_drugs | ...
    drugChannel: text("drug_channel"), // retail | mail
    estimateBreakdown: text("estimate_breakdown"), // JSON EstimateBreakdown
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("prescriptions_user_id_idx").on(t.userId),
    index("prescriptions_category_id_idx").on(t.categoryId),
    index("prescriptions_next_refill_date_idx").on(t.nextRefillDate),
    index("prescriptions_health_plan_id_idx").on(t.healthPlanId),
  ]
);

// --- Recurring series (therapy, haircuts, cleanings...; spawns Appointment occurrences) ---

export const financeRecurringSeries = finance.table(
  "recurring_series",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    domain: text("domain").notNull().default("health"), // health | lifestyle
    kind: text("kind").notNull().default("other"),
    provider: text("provider"),
    location: text("location"),
    amount: money("amount").notNull().default("0"), // expected out-of-pocket cost
    cadence: text("cadence").notNull().default("monthly"), // weekly | biweekly | every_4_weeks | monthly | quarterly | every_6_months | annual
    nextDate: timestamp("next_date"),
    isActive: boolean("is_active").notNull().default(true),
    categoryId: text("category_id")
      .notNull()
      .references(() => financeCategories.id),
    billId: text("bill_id")
      .unique()
      .references(() => financeBills.id, { onDelete: "set null" }),
    healthPlanId: text("health_plan_id").references(() => financeHealthPlans.id, {
      onDelete: "set null",
    }),
    sbcServiceKeys: text("sbc_service_keys"), // JSON string[]
    allowedAmount: money("allowed_amount"),
    estimateBreakdown: text("estimate_breakdown"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("recurring_series_user_id_idx").on(t.userId),
    index("recurring_series_domain_idx").on(t.domain),
    index("recurring_series_category_id_idx").on(t.categoryId),
    index("recurring_series_next_date_idx").on(t.nextDate),
    index("recurring_series_is_active_idx").on(t.isActive),
    index("recurring_series_health_plan_id_idx").on(t.healthPlanId),
  ]
);

// --- Appointments (care / routine visits with expected cost) ---

export const financeAppointments = finance.table(
  "appointments",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    provider: text("provider"),
    location: text("location"),
    kind: text("kind").notNull().default("visit"), // visit | dental | vision | procedure | lab | therapy | hair | personal_care | other
    scheduledAt: timestamp("scheduled_at"),
    status: text("status").notNull().default("planned"), // planned | scheduled | done | cancelled
    expectedCost: money("expected_cost").notNull().default("0"),
    categoryId: text("category_id")
      .notNull()
      .references(() => financeCategories.id),
    healthPlanId: text("health_plan_id").references(() => financeHealthPlans.id, {
      onDelete: "set null",
    }),
    seriesId: text("series_id").references(() => financeRecurringSeries.id, {
      onDelete: "set null",
    }),
    sbcServiceKeys: text("sbc_service_keys"), // JSON string[] of catalog keys
    allowedAmount: money("allowed_amount"),
    estimateBreakdown: text("estimate_breakdown"), // JSON EstimateBreakdown
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("appointments_user_id_idx").on(t.userId),
    index("appointments_category_id_idx").on(t.categoryId),
    index("appointments_scheduled_at_idx").on(t.scheduledAt),
    index("appointments_status_idx").on(t.status),
    index("appointments_health_plan_id_idx").on(t.healthPlanId),
    index("appointments_series_id_idx").on(t.seriesId),
  ]
);

// --- Vision supplies (contacts, glasses; optional Bill sync) ---

export const financeVisionSupplies = finance.table(
  "vision_supplies",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("contacts"), // contacts | glasses | solution | other
    brand: text("brand"),
    retailer: text("retailer"),
    amount: money("amount").notNull().default("0"),
    cadence: text("cadence").notNull().default("quarterly"), // monthly | quarterly | semi_annual | annual | as_needed
    nextOrderDate: timestamp("next_order_date"),
    isActive: boolean("is_active").notNull().default(true),
    categoryId: text("category_id")
      .notNull()
      .references(() => financeCategories.id),
    billId: text("bill_id")
      .unique()
      .references(() => financeBills.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("vision_supplies_user_id_idx").on(t.userId),
    index("vision_supplies_category_id_idx").on(t.categoryId),
    index("vision_supplies_next_order_date_idx").on(t.nextOrderDate),
  ]
);

// --- Home / vehicle budget lines ---

export const financeHomeLines = finance.table(
  "home_lines",
  {
    id: id(),
    userId: userId(),
    homeId: text("home_id")
      .notNull()
      .references(() => financeHomes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull(), // rent | mortgage | property_tax | maintenance | utilities | internet | insurance | hoa | parking | use | other
    categoryId: text("category_id")
      .notNull()
      .unique()
      .references(() => financeCategories.id),
    sortOrder: integer("sort_order").notNull().default(0),
    provider: text("provider"), // PG&E, Comcast, State Farm...
    amount: money("amount").notNull().default("0"), // paid each cadence period
    cadence: text("cadence").notNull().default("monthly"), // monthly | quarterly | semi_annual | annual
    nextDate: timestamp("next_date"),
    billId: text("bill_id")
      .unique()
      .references(() => financeBills.id, { onDelete: "set null" }),
  },
  (t) => [
    index("home_lines_user_id_idx").on(t.userId),
    index("home_lines_home_id_idx").on(t.homeId),
  ]
);

export const financeVehicleLines = finance.table(
  "vehicle_lines",
  {
    id: id(),
    userId: userId(),
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => financeVehicles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull(), // payment | insurance | fuel | maintenance | parking | registration | other
    categoryId: text("category_id")
      .notNull()
      .unique()
      .references(() => financeCategories.id),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("vehicle_lines_user_id_idx").on(t.userId),
    index("vehicle_lines_vehicle_id_idx").on(t.vehicleId),
  ]
);

// --- Trips (event budgets; reuse Travel CoA categories) ---

export const financeTrips = finance.table(
  "trips",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    destination: text("destination"),
    status: text("status").notNull().default("idea"), // idea | planning | booked | done | cancelled
    itineraryType: text("itinerary_type").notNull().default("round_trip"), // round_trip | multi_city
    dateFlexDays: integer("date_flex_days").notNull().default(0), // 0 | 1 | 2 | 3 | 7 | 14
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    notes: text("notes"),
    originIata: text("origin_iata"), // summary of first leg
    destinationIata: text("destination_iata"), // summary of last outbound stop
    stayMode: text("stay_mode"), // own_home | friend | book (round_trip)
    homeId: text("home_id").references(() => financeHomes.id, { onDelete: "set null" }),
    hostName: text("host_name"),
    preferredAirline: text("preferred_airline").notNull().default("UA"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("trips_user_slug_unique").on(t.userId, t.slug),
    index("trips_home_id_idx").on(t.homeId),
  ]
);

export const financeTripDayItems = finance.table(
  "trip_day_items",
  {
    id: id(),
    userId: userId(),
    tripId: text("trip_id")
      .notNull()
      .references(() => financeTrips.id, { onDelete: "cascade" }),
    date: timestamp("date").notNull(), // calendar day at local noon
    kind: text("kind").notNull(), // person | event | activity
    title: text("title").notNull(),
    notes: text("notes"),
    time: text("time"), // HH:mm optional
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("trip_day_items_user_id_idx").on(t.userId),
    index("trip_day_items_trip_date_idx").on(t.tripId, t.date),
  ]
);

export const financeTripNightStays = finance.table(
  "trip_night_stays",
  {
    id: id(),
    userId: userId(),
    tripId: text("trip_id")
      .notNull()
      .references(() => financeTrips.id, { onDelete: "cascade" }),
    date: timestamp("date").notNull(), // calendar day at local noon
    label: text("label").notNull(), // where you sleep that night
    stayMode: text("stay_mode"), // own_home | friend | book
    homeId: text("home_id").references(() => financeHomes.id, { onDelete: "set null" }),
    hostName: text("host_name"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("trip_night_stays_trip_date_unique").on(t.tripId, t.date),
    index("trip_night_stays_user_id_idx").on(t.userId),
    index("trip_night_stays_home_id_idx").on(t.homeId),
  ]
);

export const financeTripLegs = finance.table(
  "trip_legs",
  {
    id: id(),
    userId: userId(),
    tripId: text("trip_id")
      .notNull()
      .references(() => financeTrips.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    originIata: text("origin_iata").notNull(),
    destinationIata: text("destination_iata").notNull(),
    departureDate: timestamp("departure_date"),
    destination: text("destination"), // city label for UI / geocode
    stayMode: text("stay_mode"), // own_home | friend | book - overnight at destination
    homeId: text("home_id").references(() => financeHomes.id, { onDelete: "set null" }),
    hostName: text("host_name"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("trip_legs_user_id_idx").on(t.userId),
    index("trip_legs_trip_id_idx").on(t.tripId),
    index("trip_legs_home_id_idx").on(t.homeId),
  ]
);

export const financeTripLines = finance.table(
  "trip_lines",
  {
    id: id(),
    userId: userId(),
    tripId: text("trip_id")
      .notNull()
      .references(() => financeTrips.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull(), // flights | lodging | food | activities | transport | other
    categoryId: text("category_id")
      .notNull()
      .references(() => financeCategories.id),
    plannedAmount: money("planned_amount").notNull().default("0"),
    bookingStatus: text("booking_status").notNull().default("todo"), // todo | chosen | booked | paid | not_needed
    dueDate: timestamp("due_date"),
    confirmationCode: text("confirmation_code"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("trip_lines_user_id_idx").on(t.userId),
    index("trip_lines_trip_id_idx").on(t.tripId),
    index("trip_lines_category_id_idx").on(t.categoryId),
  ]
);

export const financeTripOptions = finance.table(
  "trip_options",
  {
    id: id(),
    userId: userId(),
    tripId: text("trip_id")
      .notNull()
      .references(() => financeTrips.id, { onDelete: "cascade" }),
    tripLineId: text("trip_line_id").references(() => financeTripLines.id, {
      onDelete: "set null",
    }),
    kind: text("kind").notNull(), // flight | lodging
    provider: text("provider").notNull().default("duffel"),
    externalId: text("external_id").notNull(),
    expiresAt: timestamp("expires_at"),
    selected: boolean("selected").notNull().default(false),
    amount: money("amount").notNull().default("0"),
    currency: text("currency").notNull().default("USD"),
    summary: text("summary").notNull(),
    detail: text("detail").notNull(), // JSON snapshot
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("trip_options_user_id_idx").on(t.userId),
    index("trip_options_trip_id_idx").on(t.tripId),
    index("trip_options_trip_line_id_idx").on(t.tripLineId),
    index("trip_options_kind_selected_idx").on(t.kind, t.selected),
  ]
);

// --- Cashflow ---

export const financeTransactions = finance.table(
  "transactions",
  {
    id: id(),
    userId: userId(),
    accountId: text("account_id")
      .notNull()
      .references(() => financeAccounts.id),
    entityId: text("entity_id")
      .notNull()
      .references(() => financeEntities.id),
    date: timestamp("date").notNull(),
    amount: money("amount").notNull(), // positive = inflow to account, negative = outflow
    type: text("type").notNull(), // income | expense | transfer | contribution | distribution | tax_payment
    memo: text("memo"),
    categoryId: text("category_id").references(() => financeCategories.id, {
      onDelete: "set null",
    }),
    billId: text("bill_id").references(() => financeBills.id, { onDelete: "set null" }),
    tripId: text("trip_id").references(() => financeTrips.id, { onDelete: "set null" }),
    transferPairId: text("transfer_pair_id"),
    plaidTxnId: text("plaid_txn_id"),
    pending: boolean("pending").notNull().default(false),
    reconciledAt: timestamp("reconciled_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("transactions_user_plaid_txn_unique").on(t.userId, t.plaidTxnId),
    index("transactions_user_date_idx").on(t.userId, t.date),
    index("transactions_entity_id_idx").on(t.entityId),
    index("transactions_category_id_idx").on(t.categoryId),
    index("transactions_account_date_idx").on(t.accountId, t.date),
    index("transactions_trip_id_idx").on(t.tripId),
    index("transactions_bill_id_idx").on(t.billId),
  ]
);

export const financeIncomeSources = finance.table(
  "income_sources",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    entityId: text("entity_id").references(() => financeEntities.id, {
      onDelete: "set null",
    }),
    categoryId: text("category_id").references(() => financeCategories.id, {
      onDelete: "set null",
    }),
    taxCharacter: text("tax_character").notNull(), // schedule_c | w2 | k1_ordinary | rental | interest | qualified_dividend | ltcg | tax_exempt | support
    expectedMonthly: money("expected_monthly").notNull().default("0"),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
  },
  (t) => [
    index("income_sources_user_id_idx").on(t.userId),
    index("income_sources_entity_id_idx").on(t.entityId),
    index("income_sources_category_id_idx").on(t.categoryId),
  ]
);

// --- Future planning (lifestyle target + investment strategy) ---

export const financeFuturePlans = finance.table(
  "future_plans",
  {
    id: id(),
    userId: userId(),
    slug: text("slug").notNull().default("default"),
    /** Null = use current month lifestyle budget as the target */
    desiredMonthlyLifestyle: money("desired_monthly_lifestyle"),
    monthlyContribution: money("monthly_contribution").notNull().default("0"),
    strategyKey: text("strategy_key").notNull().default("balanced"), // conservative | balanced | income | growth | custom
    expectedReturnRate: doublePrecision("expected_return_rate").notNull().default(0.07),
    inflationRate: doublePrecision("inflation_rate").notNull().default(0.025),
    withdrawalRate: doublePrecision("withdrawal_rate").notNull().default(0.04),
    horizonYears: integer("horizon_years").notNull().default(25),
    includeCashInPortfolio: boolean("include_cash_in_portfolio").notNull().default(false),
    taxBufferPercent: doublePrecision("tax_buffer_percent").notNull().default(0.15),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("future_plans_user_slug_unique").on(t.userId, t.slug)]
);

// --- Budget ---

export const financeBudgets = finance.table(
  "budgets",
  {
    id: id(),
    userId: userId(),
    year: integer("year").notNull(),
    month: integer("month").notNull(), // 1-12
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("budgets_user_year_month_unique").on(t.userId, t.year, t.month)]
);

export const financeBudgetLines = finance.table(
  "budget_lines",
  {
    id: id(),
    userId: userId(),
    budgetId: text("budget_id")
      .notNull()
      .references(() => financeBudgets.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => financeCategories.id),
    cashPlan: money("cash_plan").notNull().default("0"),
    reviewed: boolean("reviewed").notNull().default(false),
  },
  (t) => [
    unique("budget_lines_budget_category_unique").on(t.budgetId, t.categoryId),
    index("budget_lines_user_id_idx").on(t.userId),
    index("budget_lines_category_id_idx").on(t.categoryId),
  ]
);

// --- Taxes ---

export const financeTaxProfiles = finance.table(
  "tax_profiles",
  {
    id: id(),
    userId: userId(),
    filingStatus: text("filing_status").notNull().default("single"), // single | mfj | mfs | hoh
    residentState: text("resident_state").notNull().default("CA"),
    /** Primary filer identity (for printable return PDFs) */
    legalName: text("legal_name"),
    occupation: text("occupation"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    state: text("state"), // mailing state code
    zip: text("zip"),
    phone: text("phone"),
    /** AES-GCM encrypted SSN (full 9 digits); never expose in client HTML */
    ssnEnc: text("ssn_enc"),
    spouseLegalName: text("spouse_legal_name"),
    spouseSsnEnc: text("spouse_ssn_enc"),
    priorYearTotalTax: money("prior_year_total_tax").notNull().default("0"), // legacy; prefer tax_year_profiles
    priorYearFederalTax: money("prior_year_federal_tax").notNull().default("0"),
    priorYearCaTax: money("prior_year_ca_tax").notNull().default("0"),
    withholdingYtd: money("withholding_ytd").notNull().default("0"),
    withholdingFederalYtd: money("withholding_federal_ytd").notNull().default("0"),
    withholdingCaYtd: money("withholding_ca_ytd").notNull().default("0"),
    notes: text("notes"),
  },
  (t) => [unique("tax_profiles_user_unique").on(t.userId)]
);

/** Per-tax-year interview snapshot + safe harbor / withholding. */
export const financeTaxYearProfiles = finance.table(
  "tax_year_profiles",
  {
    id: id(),
    userId: userId(),
    year: integer("year").notNull(),
    /** Override global tax_profiles value for this year when set */
    filingStatus: text("filing_status"),
    residentState: text("resident_state"),
    /** NYC when NY city resident; null otherwise */
    residentLocality: text("resident_locality"),
    partYearResident: boolean("part_year_resident").notNull().default(false),
    hasW2: boolean("has_w2"),
    hasSelfEmployment: boolean("has_self_employment"),
    hasInvestments: boolean("has_investments"),
    hasRental: boolean("has_rental"),
    hasK1: boolean("has_k1"),
    hasDependents: boolean("has_dependents").notNull().default(false),
    /** standard | itemize (itemize falls back to standard in compute for now) */
    deductionMethod: text("deduction_method").notNull().default("standard"),
    businessExpensesReviewedAt: timestamp("business_expenses_reviewed_at"),
    /** Calendar day the return was actually filed (distinct from the deadline) */
    returnFiledAt: timestamp("return_filed_at"),
    priorYearFederalTax: money("prior_year_federal_tax").notNull().default("0"),
    priorYearStateTax: money("prior_year_state_tax").notNull().default("0"),
    priorYearLocalTax: money("prior_year_local_tax").notNull().default("0"),
    /** Legacy alias - synced with priorYearStateTax for CA years */
    priorYearCaTax: money("prior_year_ca_tax").notNull().default("0"),
    withholdingFederalYtd: money("withholding_federal_ytd").notNull().default("0"),
    withholdingStateYtd: money("withholding_state_ytd").notNull().default("0"),
    withholdingLocalYtd: money("withholding_local_ytd").notNull().default("0"),
    /** Legacy alias - synced with withholdingStateYtd */
    withholdingCaYtd: money("withholding_ca_ytd").notNull().default("0"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("tax_year_profiles_user_year_unique").on(t.userId, t.year)]
);

export const financeTaxYearParams = finance.table(
  "tax_year_params",
  {
    id: id(),
    userId: userId(),
    year: integer("year").notNull(),
    // Legacy single-status scalars (kept populated for single filer fallback)
    standardDeduction: money("standard_deduction").notNull(),
    ssWageBase: money("ss_wage_base").notNull(),
    seSocialSecurityRate: doublePrecision("se_social_security_rate").notNull().default(0.124),
    seMedicareRate: doublePrecision("se_medicare_rate").notNull().default(0.029),
    federalBracketsJson: text("federal_brackets_json").notNull(), // JSON array of {upTo, rate}
    caBracketsJson: text("ca_brackets_json").notNull(),
    caMentalHealthRate: doublePrecision("ca_mental_health_rate").notNull().default(0.01),
    caMentalHealthThreshold: money("ca_mental_health_threshold").notNull().default("1000000"),
    qbiSimpleRate: doublePrecision("qbi_simple_rate").notNull().default(0.2),
    /** Filing-status-aware tables (brackets, std ded, QBI, NIIT, LTCG, etc.) */
    tablesJson: text("tables_json").notNull().default("{}"),
    notes: text("notes"),
  },
  (t) => [unique("tax_year_params_user_year_unique").on(t.userId, t.year)]
);

export const financeTaxActivities = finance.table(
  "tax_activities",
  {
    id: id(),
    userId: userId(),
    entityId: text("entity_id")
      .notNull()
      .references(() => financeEntities.id),
    year: integer("year").notNull(),
    formType: text("form_type").notNull(), // schedule_c | schedule_e | k1 | w2 | investments
    /** Canonical character for the engine (defaults derived from formType if empty) */
    taxCharacter: text("tax_character").notNull().default(""), // w2_wages | schedule_c | k1_ordinary | rental | ...
    label: text("label").notNull(),
    profit: money("profit").notNull().default("0"), // amount for character (wages, net profit, etc.)
    /** Schedule C PDF detail (optional). Net tax still uses `profit`. */
    grossReceipts: money("gross_receipts"),
    expenses: money("expenses"),
    qbiAmount: money("qbi_amount"), // section 199A QBI portion when distinct from profit
    ssWages: money("ss_wages"), // W-2 box 3
    medicareWages: money("medicare_wages"), // W-2 box 5
    notes: text("notes"),
  },
  (t) => [
    index("tax_activities_user_year_idx").on(t.userId, t.year),
    index("tax_activities_entity_id_idx").on(t.entityId),
  ]
);

/** Schedule C Part II expense categories for a tax year activity. */
export const financeTaxBusinessExpenses = finance.table(
  "tax_business_expenses",
  {
    id: id(),
    userId: userId(),
    year: integer("year").notNull(),
    activityId: text("activity_id")
      .notNull()
      .references(() => financeTaxActivities.id, { onDelete: "cascade" }),
    /**
     * advertising | carTruck | contractLabor | depreciation | insurance |
     * legalProfessional | officeExpense | supplies | travel | meals | utilities | other
     */
    category: text("category").notNull(),
    amount: money("amount").notNull().default("0"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("tax_business_expenses_activity_category_unique").on(t.activityId, t.category),
    index("tax_business_expenses_user_year_idx").on(t.userId, t.year),
    index("tax_business_expenses_activity_id_idx").on(t.activityId),
  ]
);

export const financeTaxEvents = finance.table(
  "tax_events",
  {
    id: id(),
    userId: userId(),
    year: integer("year").notNull(),
    date: timestamp("date").notNull(),
    type: text("type").notNull(), // estimated_payment | security_sale | retirement_contribution | health_insurance_deduction
    jurisdiction: text("jurisdiction"), // federal | CA
    quarter: integer("quarter"),
    amount: money("amount").notNull(),
    /** For security_sale: proceeds - basis style fields */
    proceeds: money("proceeds"),
    basis: money("basis"),
    term: text("term"), // long | short
    notes: text("notes"),
  },
  (t) => [index("tax_events_user_year_idx").on(t.userId, t.year)]
);

export const financeTaxCapitalGains = finance.table(
  "tax_capital_gains",
  {
    id: id(),
    userId: userId(),
    year: integer("year").notNull(),
    date: timestamp("date"),
    description: text("description").notNull(),
    proceeds: money("proceeds").notNull().default("0"),
    basis: money("basis").notNull().default("0"),
    term: text("term").notNull().default("long"), // long | short
    notes: text("notes"),
  },
  (t) => [index("tax_capital_gains_user_year_idx").on(t.userId, t.year)]
);

// --- Personal documents (passport, license, voter registration, etc.) ---

export const financePersonalDocuments = finance.table(
  "personal_documents",
  {
    id: id(),
    userId: userId(),
    kind: text("kind").notNull().default("other"), // passport | drivers_license | voter_registration | other
    name: text("name").notNull(),
    holder: text("holder"),
    issuer: text("issuer"),
    identifierEnc: text("identifier_enc"), // ciphertext only
    issuedOn: timestamp("issued_on"),
    renewsOn: timestamp("renews_on"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("personal_documents_user_kind_idx").on(t.userId, t.kind),
    index("personal_documents_renews_on_idx").on(t.renewsOn),
  ]
);

/** Uploaded 1099 / brokerage tax file for a tax year (Blob or local path). */
export const financeTaxDocuments = finance.table(
  "tax_documents",
  {
    id: id(),
    userId: userId(),
    year: integer("year").notNull(),
    formKind: text("form_kind").notNull().default("other"), // 1099_div | 1099_int | 1099_b | consolidated_1099 | other
    payerName: text("payer_name"),
    accountId: text("account_id").references(() => financeAccounts.id, {
      onDelete: "set null",
    }),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    blobUrl: text("blob_url").notNull(),
    status: text("status").notNull().default("uploaded"), // uploaded | extracting | ready | failed | committed
    error: text("error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("tax_documents_user_year_idx").on(t.userId, t.year)]
);

/** Proposed (or committed) extract line from a tax document. */
export const financeTaxDocumentLines = finance.table(
  "tax_document_lines",
  {
    id: id(),
    userId: userId(),
    documentId: text("document_id")
      .notNull()
      .references(() => financeTaxDocuments.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"), // pending | accepted | rejected | committed
    target: text("target").notNull(), // activity | capital_gain
    taxCharacter: text("tax_character"),
    label: text("label"),
    amount: money("amount"),
    entityId: text("entity_id").references(() => financeEntities.id, {
      onDelete: "set null",
    }),
    description: text("description"),
    proceeds: money("proceeds"),
    basis: money("basis"),
    term: text("term"), // long | short
    date: timestamp("date"),
    sourceBox: text("source_box"),
    rawJson: text("raw_json"),
    committedActivityId: text("committed_activity_id"),
    committedCapitalGainId: text("committed_capital_gain_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("tax_document_lines_user_id_idx").on(t.userId),
    index("tax_document_lines_document_id_idx").on(t.documentId),
    index("tax_document_lines_entity_id_idx").on(t.entityId),
  ]
);

// --- Inferred types ---

export type FinanceEntity = typeof financeEntities.$inferSelect;
export type NewFinanceEntity = typeof financeEntities.$inferInsert;
export type FinanceStake = typeof financeStakes.$inferSelect;
export type NewFinanceStake = typeof financeStakes.$inferInsert;
export type FinancePlaidItem = typeof financePlaidItems.$inferSelect;
export type NewFinancePlaidItem = typeof financePlaidItems.$inferInsert;
export type FinanceAccount = typeof financeAccounts.$inferSelect;
export type NewFinanceAccount = typeof financeAccounts.$inferInsert;
export type FinanceCategoryGroup = typeof financeCategoryGroups.$inferSelect;
export type NewFinanceCategoryGroup = typeof financeCategoryGroups.$inferInsert;
export type FinanceCategory = typeof financeCategories.$inferSelect;
export type NewFinanceCategory = typeof financeCategories.$inferInsert;
export type FinanceBill = typeof financeBills.$inferSelect;
export type NewFinanceBill = typeof financeBills.$inferInsert;
export type FinanceHome = typeof financeHomes.$inferSelect;
export type NewFinanceHome = typeof financeHomes.$inferInsert;
export type FinanceVehicle = typeof financeVehicles.$inferSelect;
export type NewFinanceVehicle = typeof financeVehicles.$inferInsert;
export type FinanceAsset = typeof financeAssets.$inferSelect;
export type NewFinanceAsset = typeof financeAssets.$inferInsert;
export type FinanceAssetInterest = typeof financeAssetInterests.$inferSelect;
export type NewFinanceAssetInterest = typeof financeAssetInterests.$inferInsert;
export type FinanceLiability = typeof financeLiabilities.$inferSelect;
export type NewFinanceLiability = typeof financeLiabilities.$inferInsert;
export type FinanceAgentInsight = typeof financeAgentInsights.$inferSelect;
export type NewFinanceAgentInsight = typeof financeAgentInsights.$inferInsert;
export type FinanceAgentCategoryMemory = typeof financeAgentCategoryMemory.$inferSelect;
export type NewFinanceAgentCategoryMemory = typeof financeAgentCategoryMemory.$inferInsert;
export type FinanceHealthPlan = typeof financeHealthPlans.$inferSelect;
export type NewFinanceHealthPlan = typeof financeHealthPlans.$inferInsert;
export type FinanceHealthPlanBenefit = typeof financeHealthPlanBenefits.$inferSelect;
export type NewFinanceHealthPlanBenefit = typeof financeHealthPlanBenefits.$inferInsert;
export type FinancePrescription = typeof financePrescriptions.$inferSelect;
export type NewFinancePrescription = typeof financePrescriptions.$inferInsert;
export type FinanceRecurringSeries = typeof financeRecurringSeries.$inferSelect;
export type NewFinanceRecurringSeries = typeof financeRecurringSeries.$inferInsert;
export type FinanceAppointment = typeof financeAppointments.$inferSelect;
export type NewFinanceAppointment = typeof financeAppointments.$inferInsert;
export type FinanceVisionSupply = typeof financeVisionSupplies.$inferSelect;
export type NewFinanceVisionSupply = typeof financeVisionSupplies.$inferInsert;
export type FinanceHomeLine = typeof financeHomeLines.$inferSelect;
export type NewFinanceHomeLine = typeof financeHomeLines.$inferInsert;
export type FinanceVehicleLine = typeof financeVehicleLines.$inferSelect;
export type NewFinanceVehicleLine = typeof financeVehicleLines.$inferInsert;
export type FinanceTrip = typeof financeTrips.$inferSelect;
export type NewFinanceTrip = typeof financeTrips.$inferInsert;
export type FinanceTripDayItem = typeof financeTripDayItems.$inferSelect;
export type NewFinanceTripDayItem = typeof financeTripDayItems.$inferInsert;
export type FinanceTripNightStay = typeof financeTripNightStays.$inferSelect;
export type NewFinanceTripNightStay = typeof financeTripNightStays.$inferInsert;
export type FinanceTripLeg = typeof financeTripLegs.$inferSelect;
export type NewFinanceTripLeg = typeof financeTripLegs.$inferInsert;
export type FinanceTripLine = typeof financeTripLines.$inferSelect;
export type NewFinanceTripLine = typeof financeTripLines.$inferInsert;
export type FinanceTripOption = typeof financeTripOptions.$inferSelect;
export type NewFinanceTripOption = typeof financeTripOptions.$inferInsert;
export type FinanceTransaction = typeof financeTransactions.$inferSelect;
export type NewFinanceTransaction = typeof financeTransactions.$inferInsert;
export type FinanceIncomeSource = typeof financeIncomeSources.$inferSelect;
export type NewFinanceIncomeSource = typeof financeIncomeSources.$inferInsert;
export type FinanceFuturePlan = typeof financeFuturePlans.$inferSelect;
export type NewFinanceFuturePlan = typeof financeFuturePlans.$inferInsert;
export type FinanceBudget = typeof financeBudgets.$inferSelect;
export type NewFinanceBudget = typeof financeBudgets.$inferInsert;
export type FinanceBudgetLine = typeof financeBudgetLines.$inferSelect;
export type NewFinanceBudgetLine = typeof financeBudgetLines.$inferInsert;
export type FinanceTaxProfile = typeof financeTaxProfiles.$inferSelect;
export type NewFinanceTaxProfile = typeof financeTaxProfiles.$inferInsert;
export type FinanceTaxYearProfile = typeof financeTaxYearProfiles.$inferSelect;
export type NewFinanceTaxYearProfile = typeof financeTaxYearProfiles.$inferInsert;
export type FinanceTaxYearParams = typeof financeTaxYearParams.$inferSelect;
export type NewFinanceTaxYearParams = typeof financeTaxYearParams.$inferInsert;
export type FinanceTaxActivity = typeof financeTaxActivities.$inferSelect;
export type NewFinanceTaxActivity = typeof financeTaxActivities.$inferInsert;
export type FinanceTaxBusinessExpense = typeof financeTaxBusinessExpenses.$inferSelect;
export type NewFinanceTaxBusinessExpense = typeof financeTaxBusinessExpenses.$inferInsert;
export type FinanceTaxEvent = typeof financeTaxEvents.$inferSelect;
export type NewFinanceTaxEvent = typeof financeTaxEvents.$inferInsert;
export type FinanceTaxCapitalGain = typeof financeTaxCapitalGains.$inferSelect;
export type NewFinanceTaxCapitalGain = typeof financeTaxCapitalGains.$inferInsert;
export type FinancePersonalDocument = typeof financePersonalDocuments.$inferSelect;
export type NewFinancePersonalDocument = typeof financePersonalDocuments.$inferInsert;
export type FinanceTaxDocument = typeof financeTaxDocuments.$inferSelect;
export type NewFinanceTaxDocument = typeof financeTaxDocuments.$inferInsert;
export type FinanceTaxDocumentLine = typeof financeTaxDocumentLines.$inferSelect;
export type NewFinanceTaxDocumentLine = typeof financeTaxDocumentLines.$inferInsert;
