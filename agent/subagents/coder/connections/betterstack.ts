import { connect } from "@vercel/connect/eve";
import { defineDynamic, defineMcpClientConnection } from "eve/connections";

import {
  CONNECTION_BETTERSTACK_ALLOWLIST,
  CONNECTION_WRITE_TOOLS,
} from "../../../lib/connection-allowlists.js";
import { writeToolApproval } from "../../../lib/connection-approval.js";
import { isBetterAuthUserPrincipal } from "../../../lib/user-connection.js";
import { connectionTokenParams } from "@/lib/connections/oauth-scopes";

// BETTERSTACK_CONNECTOR is the Vercel Connect UID for Better Stack's hosted
// MCP server (https://mcp.betterstack.com). Managed Connect create may 404;
// register a DCR client against https://betterstack.com/oauth/register
// (redirect https://connect.vercel.com/callback, auth method none), then:
//   vercel connect create https://mcp.betterstack.com --name pearl-betterstack \
//     --connector-type oauth --data @.secrets/pearl-betterstack-connect-create.json
// Scopes read + write. Reads run freely; incident, monitor, dashboard, and
// team writes need approval every call and are denied in plan mode.
export default defineDynamic((ctx) => {
  const connector = process.env.BETTERSTACK_CONNECTOR?.trim();
  if (!connector || !isBetterAuthUserPrincipal(ctx.session.auth.current)) {
    return null;
  }

  return defineMcpClientConnection({
    url: "https://mcp.betterstack.com",
    description:
      "The signed-in user's Better Stack account: uptime monitors, incidents, " +
      "on-call, status pages, telemetry sources, dashboards, metrics, and " +
      "errors. Reads run freely; creates, updates, and incident actions need " +
      "approval.",
    instanceKey: `betterstack:${connector}`,
    auth: connect({
      connector,
      autoProvision: false,
      tokenParams: connectionTokenParams("betterstack"),
    }),
    tools: { allow: [...CONNECTION_BETTERSTACK_ALLOWLIST] },
    approval: writeToolApproval(CONNECTION_WRITE_TOOLS.betterstack),
  });
});
