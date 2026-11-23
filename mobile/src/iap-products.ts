/** Mirrors server defaults in lib/billing/config.ts — keep product ids in sync. */
export const APPLE_IAP_SUBSCRIPTION_ID = "pearl_monthly_10";

export const APPLE_USAGE_PACKS = [
  { productId: "pearl_usage_10", creditCents: 1000, label: "$10 usage credits" },
  { productId: "pearl_usage_25", creditCents: 2500, label: "$25 usage credits" },
  { productId: "pearl_usage_50", creditCents: 5000, label: "$50 usage credits" },
] as const;

export const APPLE_USAGE_PRODUCT_IDS = APPLE_USAGE_PACKS.map(
  (pack) => pack.productId,
);

export const APPLE_SUBSCRIPTIONS_MANAGE_URL =
  "https://apps.apple.com/account/subscriptions";
