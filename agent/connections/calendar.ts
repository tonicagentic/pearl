import { connect } from "@vercel/connect/eve";
import { defineDynamic, defineMcpClientConnection } from "eve/connections";

import { CONNECTION_READONLY_ALLOWLISTS } from "../lib/connection-allowlists.js";
import { isBetterAuthUserPrincipal } from "../lib/user-connection.js";

// CALENDAR_CONNECTOR is the Vercel Connect UID for the Calendar Workspace MCP
// OAuth connector. Create with:
//   vercel connect create https://calendarmcp.googleapis.com/mcp/v1 --name calendar
export default defineDynamic({
  events: {
    "turn.started": (_event, ctx) => {
      const connector = process.env.CALENDAR_CONNECTOR?.trim();
      if (!connector || !isBetterAuthUserPrincipal(ctx.session.auth.current)) {
        return null;
      }

      return defineMcpClientConnection({
        url: "https://calendarmcp.googleapis.com/mcp/v1",
        description:
          "Read the signed-in user's Google Calendar: list calendars, search and read events, suggest times.",
        instanceKey: `calendar:${connector}:readonly`,
        auth: connect({ connector, autoProvision: false }),
        tools: { allow: [...CONNECTION_READONLY_ALLOWLISTS.calendar] },
      });
    },
  },
});
