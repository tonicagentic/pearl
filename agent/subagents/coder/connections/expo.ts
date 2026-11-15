import { connect } from "@vercel/connect/eve";
import { defineDynamic, defineMcpClientConnection } from "eve/connections";

import {
  CONNECTION_EXPO_ALLOWLIST,
  CONNECTION_WRITE_TOOLS,
} from "../../../lib/connection-allowlists.js";
import { writeToolApproval } from "../../../lib/connection-approval.js";
import { isBetterAuthUserPrincipal } from "../../../lib/user-connection.js";
import { connectionTokenParams } from "@/lib/connections/oauth-scopes";

// EXPO_CONNECTOR is the Vercel Connect UID for Expo's hosted MCP server
// (https://mcp.expo.dev/mcp). Create with:
//   vercel connect create https://mcp.expo.dev/mcp --name pearl-expo
// Scope mcp:access. Reads run freely; writes / metered actions need approval
// every call and are denied in plan mode.
export default defineDynamic((ctx) => {
  const connector = process.env.EXPO_CONNECTOR?.trim();
  if (!connector || !isBetterAuthUserPrincipal(ctx.session.auth.current)) {
    return null;
  }

  return defineMcpClientConnection({
    url: "https://mcp.expo.dev/mcp",
    description:
      "The signed-in user's Expo account: docs, EAS builds and workflows, " +
      "cloud simulators, Observe metrics, and TestFlight. Pass appId or " +
      "@owner/slug from list_expo_projects. Writes and simulator starts need " +
      "approval.",
    instanceKey: `expo:${connector}`,
    auth: connect({
      connector,
      autoProvision: false,
      tokenParams: connectionTokenParams("expo"),
    }),
    tools: { allow: [...CONNECTION_EXPO_ALLOWLIST] },
    approval: writeToolApproval(CONNECTION_WRITE_TOOLS.expo),
  });
});
