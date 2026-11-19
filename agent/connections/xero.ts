import { connect } from "@vercel/connect/eve";
import { defineDynamic, defineMcpClientConnection } from "eve/connections";

import { CONNECTION_WRITE_BLOCKLISTS } from "../lib/connection-allowlists.js";
import { integrationAllowed } from "../lib/gate-integration.js";
import { isBetterAuthUserPrincipal } from "../lib/user-connection.js";
import { connectionTokenParams } from "@/lib/connections/oauth-scopes";

export default defineDynamic(async (ctx) => {
  const connector = process.env.XERO_CONNECTOR?.trim();
  if (
    !connector ||
    !isBetterAuthUserPrincipal(ctx.session.auth.current) ||
    !(await integrationAllowed(ctx, "xero"))
  ) {
    return null;
  }

  return defineMcpClientConnection({
    url: "https://api.xero.com/mcp/v1",
    description:
      "Read the signed-in user's Xero organisation: connected organisations, chart of accounts, profit and loss, bank transactions, invoices, payments, and tracking categories for spend and financial questions; no writes.",
    instanceKey: `xero:${connector}:readonly`,
    auth: connect({
      connector,
      autoProvision: false,
      tokenParams: connectionTokenParams("xero"),
    }),
    tools: { block: [...CONNECTION_WRITE_BLOCKLISTS.xero] },
  });
});
