import { connect } from "@vercel/connect/eve";
import { defineDynamic, defineMcpClientConnection } from "eve/connections";

import { CONNECTION_READONLY_ALLOWLISTS } from "../../../lib/connection-allowlists.js";
import { isBetterAuthUserPrincipal } from "../../../lib/user-connection.js";

// Same hosted Vercel MCP connector as the parent, mounted on coder so
// list_teams / list_projects work inside the child. Writes stay on
// deploy_vercel (approval every call) — this allowlist is read-only.
export default defineDynamic(async (ctx) => {
  const connector = process.env.VERCEL_CONNECTOR?.trim();
  if (!connector || !isBetterAuthUserPrincipal(ctx.session.auth.current)) {
    return null;
  }

  return defineMcpClientConnection({
    url: "https://mcp.vercel.com",
    description:
      "Read the signed-in user's Vercel teams, projects, and deployment " +
      "metadata; no logs or changes. Call list_teams first, then " +
      "list_projects for the personal account and every returned team " +
      "(pass teamId or slug), following each page. One list_projects call " +
      "is only one team. Deploys use deploy_vercel, not this connection.",
    instanceKey: `coder:vercel:${connector}:readonly`,
    auth: connect({ connector, autoProvision: false }),
    tools: { allow: [...CONNECTION_READONLY_ALLOWLISTS.vercel] },
  });
});
