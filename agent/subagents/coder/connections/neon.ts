import { connect } from "@vercel/connect/eve";
import { defineDynamic, defineMcpClientConnection } from "eve/connections";

import {
  CONNECTION_NEON_ALLOWLIST,
  CONNECTION_WRITE_TOOLS,
} from "../../../lib/connection-allowlists.js";
import { writeToolApproval } from "../../../lib/connection-approval.js";
import { isBetterAuthUserPrincipal } from "../../../lib/user-connection.js";
import { connectionTokenParams } from "@/lib/connections/oauth-scopes";

// NEON_CONNECTOR is the Vercel Connect UID for Neon's hosted MCP server
// (https://mcp.neon.tech/mcp). Create with:
//   vercel connect create https://mcp.neon.tech/mcp --name pearl-neon
// Scopes read + write. Reads run freely; SQL mutations and resource writes
// need approval every call and are denied in plan mode.
export default defineDynamic((ctx) => {
  const connector = process.env.NEON_CONNECTOR?.trim();
  if (!connector || !isBetterAuthUserPrincipal(ctx.session.auth.current)) {
    return null;
  }

  return defineMcpClientConnection({
    url: "https://mcp.neon.tech/mcp",
    description:
      "The signed-in user's Neon account: organizations, projects, branches, " +
      "schemas, SQL, Auth, Functions, and storage. Prefer list_organizations / " +
      "list_projects, then pass project_id. run_sql and other writes need " +
      "approval. Never run destructive SQL without asking first.",
    instanceKey: `neon:${connector}`,
    auth: connect({
      connector,
      autoProvision: false,
      tokenParams: connectionTokenParams("neon"),
    }),
    tools: { allow: [...CONNECTION_NEON_ALLOWLIST] },
    approval: writeToolApproval(CONNECTION_WRITE_TOOLS.neon),
  });
});
