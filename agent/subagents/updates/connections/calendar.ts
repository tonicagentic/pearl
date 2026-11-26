import { connect } from "@vercel/connect/eve";
import { defineDynamic, defineMcpClientConnection } from "eve/connections";

import { CONNECTION_READONLY_ALLOWLISTS } from "../../../lib/connection-allowlists.js";
import { integrationAllowed } from "../../../lib/gate-integration.js";
import { toolSurfaceEnabled } from "../../../lib/lane-state.js";
import { isBetterAuthUserPrincipal } from "../../../lib/user-connection.js";

// Same Calendar Workspace MCP as the root — read-only for briefings.
export default defineDynamic(async (ctx) => {
  const connector = process.env.CALENDAR_CONNECTOR?.trim();
  if (
    !connector ||
    !toolSurfaceEnabled() ||
    !isBetterAuthUserPrincipal(ctx.session.auth.current) ||
    !(await integrationAllowed(ctx, "calendar"))
  ) {
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
});
