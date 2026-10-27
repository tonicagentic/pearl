import { connect } from "@vercel/connect/eve";
import { defineDynamic, defineMcpClientConnection } from "eve/connections";

import { CONNECTION_READONLY_ALLOWLISTS } from "../lib/connection-allowlists.js";
import { isBetterAuthUserPrincipal } from "../lib/user-connection.js";

// GMAIL_CONNECTOR is the Vercel Connect UID for the Gmail Workspace MCP
// OAuth connector. Create with:
//   vercel connect create https://gmailmcp.googleapis.com/mcp/v1 --name gmail
export default defineDynamic({
  events: {
    "turn.started": (_event, ctx) => {
      const connector = process.env.GMAIL_CONNECTOR?.trim();
      if (!connector || !isBetterAuthUserPrincipal(ctx.session.auth.current)) {
        return null;
      }

      return defineMcpClientConnection({
        url: "https://gmailmcp.googleapis.com/mcp/v1",
        description:
          "Read the signed-in user's Gmail: search threads, read messages, list labels and drafts.",
        instanceKey: `gmail:${connector}:readonly`,
        auth: connect({ connector, autoProvision: false }),
        tools: { allow: [...CONNECTION_READONLY_ALLOWLISTS.gmail] },
      });
    },
  },
});
