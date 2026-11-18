import { PlaidClient, PlaidEnvironment } from "plaid";

export type PlaidEnvName = "sandbox" | "development" | "production";

export function plaidConfigured() {
  return Boolean(process.env.PLAID_CLIENT_ID?.trim() && process.env.PLAID_SECRET?.trim());
}

export function getPlaidEnv(): PlaidEnvName {
  const raw = (process.env.PLAID_ENV ?? "sandbox").toLowerCase();
  if (raw === "production" || raw === "development" || raw === "sandbox") return raw;
  return "sandbox";
}

function environmentUrl(env: PlaidEnvName) {
  // Newer SDK only ships Sandbox + Production constants; Development still uses its host.
  if (env === "production") return PlaidEnvironment.Production;
  if (env === "development") return "https://development.plaid.com";
  return PlaidEnvironment.Sandbox;
}

export function getPlaidClient() {
  if (!plaidConfigured()) {
    throw new Error("Plaid is not configured. Set PLAID_CLIENT_ID and PLAID_SECRET.");
  }
  return new PlaidClient({
    clientId: process.env.PLAID_CLIENT_ID!,
    secret: process.env.PLAID_SECRET!,
    environment: environmentUrl(getPlaidEnv()),
  });
}

/**
 * Start with transactions for easiest product approval.
 * Set PLAID_PRODUCTS=transactions,investments,liabilities when those are enabled on your Plaid team.
 */
export function getPlaidProducts(): string[] {
  const raw = process.env.PLAID_PRODUCTS?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
  }
  return ["transactions"];
}

export const PLAID_COUNTRY_CODES = ["US"] as const;
