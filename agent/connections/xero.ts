import { connect } from "@vercel/connect/eve";
import { defineDynamic, defineMcpClientConnection } from "eve/connections";

import { CONNECTION_WRITE_BLOCKLISTS } from "../lib/connection-allowlists.js";
import { isBetterAuthUserPrincipal } from "../lib/user-connection.js";
import { connectionTokenParams } from "@/lib/connections/oauth-scopes";

// XERO_CONNECTOR is the Vercel Connect UID for Xero's official Remote MCP
// (https://api.xero.com/mcp/v1). Create a Xero Web app (not Custom Connection),
// put clientId/clientSecret in .secrets/pearl-xero-oauth.json, then:
//   vercel connect create https://api.xero.com/mcp/v1 --name pearl-xero \
//     --data @.secrets/pearl-xero-connect-create.json
// Redirect URI on the Xero app: https://connect.vercel.com/callback
// Pass granular scopes — Connect defaults can request deprecated broad scopes.
// Prefer the official Remote MCP URL over the `xero` service shortcut
// (mcp.xero.com), which rejected BYO Web-app tokens after consent.
// Block known write tools instead of allowlisting reads — Remote MCP tool
// names (incl. org listing) can differ from the OSS list.
export default defineDynamic({
  events: {
    "turn.started": (_event, ctx) => {
      const connector = process.env.XERO_CONNECTOR?.trim();
      if (!connector || !isBetterAuthUserPrincipal(ctx.session.auth.current)) {
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
    },
  },
});
