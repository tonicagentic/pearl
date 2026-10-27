import { connect } from "@vercel/connect/eve";
import { defineDynamic, defineMcpClientConnection } from "eve/connections";

import { CONNECTION_READONLY_ALLOWLISTS } from "../lib/connection-allowlists.js";
import { isBetterAuthUserPrincipal } from "../lib/user-connection.js";

// DRIVE_CONNECTOR is the Vercel Connect UID for the Drive Workspace MCP
// OAuth connector. Create with:
//   vercel connect create https://drivemcp.googleapis.com/mcp/v1 --name drive
export default defineDynamic({
  events: {
    "turn.started": (_event, ctx) => {
      const connector = process.env.DRIVE_CONNECTOR?.trim();
      if (!connector || !isBetterAuthUserPrincipal(ctx.session.auth.current)) {
        return null;
      }

      return defineMcpClientConnection({
        url: "https://drivemcp.googleapis.com/mcp/v1",
        description:
          "Read the signed-in user's Google Drive: search files, read content and metadata, list recent files.",
        instanceKey: `drive:${connector}:readonly`,
        auth: connect({ connector, autoProvision: false }),
        tools: { allow: [...CONNECTION_READONLY_ALLOWLISTS.drive] },
      });
    },
  },
});
