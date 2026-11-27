import {
  exchangePublicToken,
  type LinkTokenResult,
} from "@/lib/finance/plaid-link";
import {
  getPlaidClient,
  getPlaidEnv,
  getPlaidProducts,
  plaidConfigured,
} from "@/lib/finance/plaid";

/** First Platypus Bank — Plaid’s default sandbox institution. */
export const SANDBOX_INSTITUTION_ID = "ins_109508";
export const SANDBOX_INSTITUTION_NAME = "First Platypus Bank";

/**
 * Create a sandbox public token and exchange it into a Pearl ledger item.
 * Refused outside PLAID_ENV=sandbox.
 */
export async function linkSandboxBank(input: {
  entityId: string;
}): Promise<{ itemId: string } | { error: string; env: string }> {
  const env = getPlaidEnv();
  if (env !== "sandbox") {
    return {
      error: "Sandbox bank link is only available when PLAID_ENV=sandbox.",
      env,
    };
  }
  if (!plaidConfigured()) {
    return {
      error:
        "Add PLAID_CLIENT_ID and the Sandbox PLAID_SECRET from the Plaid Dashboard.",
      env,
    };
  }

  const client = getPlaidClient();
  const created = await client.sandbox.createPublicToken({
    institution_id: SANDBOX_INSTITUTION_ID,
    initial_products: getPlaidProducts() as ["transactions"],
    options: {
      override_username: "user_good",
      override_password: "pass_good",
    },
  });

  const { itemId } = await exchangePublicToken({
    publicToken: created.public_token,
    entityId: input.entityId,
    institutionName: SANDBOX_INSTITUTION_NAME,
  });

  return { itemId };
}

export function sandboxLinkAvailable(): LinkTokenResult & { sandbox: true } {
  return {
    linkToken: "",
    env: getPlaidEnv(),
    sandbox: true,
  };
}
