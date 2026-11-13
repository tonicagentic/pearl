import { connect } from "@vercel/connect/eve";
import { defineDynamic, defineMcpClientConnection } from "eve/connections";

import {
  CONNECTION_COMPOSE_ALLOWLISTS,
  CONNECTION_WRITE_TOOLS,
} from "../lib/connection-allowlists.js";
import { writeToolApproval } from "../lib/connection-approval.js";
import { toolSurfaceEnabled } from "../lib/lane-state.js";
import { isBetterAuthUserPrincipal } from "../lib/user-connection.js";
import { connectionTokenParams } from "@/lib/connections/oauth-scopes";

// GMAIL_CONNECTOR is the Vercel Connect UID for the Gmail Workspace MCP
// OAuth connector. Create with:
//   vercel connect create https://gmailmcp.googleapis.com/mcp/v1 --name gmail
// The MCP server reads mail and creates drafts; it cannot send. Sending is the
// first-party send_gmail_message tool. Both need the gmail.compose scope, so
// the connection and the token lookup share GMAIL_OAUTH_SCOPES.
export default defineDynamic((ctx) => {
      const connector = process.env.GMAIL_CONNECTOR?.trim();
      if (
        !connector ||
        !toolSurfaceEnabled() ||
        !isBetterAuthUserPrincipal(ctx.session.auth.current)
      ) {
        return null;
      }

      return defineMcpClientConnection({
        url: "https://gmailmcp.googleapis.com/mcp/v1",
        description:
          "Read the signed-in user's Gmail: search threads, read messages, list labels and drafts. Can create drafts (needs approval); it cannot send — use send_gmail_message.",
        instanceKey: `gmail:${connector}:compose`,
        auth: connect({
          connector,
          autoProvision: false,
          tokenParams: connectionTokenParams("gmail"),
        }),
        tools: { allow: [...CONNECTION_COMPOSE_ALLOWLISTS.gmail] },
        approval: writeToolApproval(CONNECTION_WRITE_TOOLS.gmail),
      });
});
