import { connect } from "@vercel/connect/eve";
import { defineDynamic, defineMcpClientConnection } from "eve/connections";

import { CONNECTION_READONLY_ALLOWLISTS } from "../lib/connection-allowlists.js";
import { integrationAllowed } from "../lib/gate-integration.js";
import { isBetterAuthUserPrincipal } from "../lib/user-connection.js";

// VERCEL_CONNECTOR is the Vercel Connect UID for the hosted Vercel MCP
// OAuth connector. Create with:
//   vercel connect create vercel --name vercel
// (or mcp.vercel.com with the MCP connection method). Scope follows the
// signed-in user's Vercel account; do not pin a team or project.
export default defineDynamic(async (ctx) => {
  const connector = process.env.VERCEL_CONNECTOR?.trim();
  if (
    !connector ||
    !isBetterAuthUserPrincipal(ctx.session.auth.current) ||
    !(await integrationAllowed(ctx, "vercel"))
  ) {
    return null;
  }

  return defineMcpClientConnection({
    url: "https://mcp.vercel.com",
    description:
      "Read the signed-in user's Vercel teams, projects, and deployment " +
      "metadata; no logs or changes. Call list_teams first, then " +
      "list_projects for the personal account and every returned team " +
      "(pass teamId or slug), following each page. One list_projects call " +
      "is only one team. To add another team on the same grant, call " +
      "authorize_team_access with that team's id or slug " +
      "(authorize_team_sso when SSO is required), show the returned link, " +
      "then list_teams again after they approve. Do not send them through " +
      "Settings → Update to add a team — that screen replaces the grant " +
      "with one team.",
    instanceKey: `vercel:${connector}:readonly`,
    auth: connect({ connector, autoProvision: false }),
    tools: { allow: [...CONNECTION_READONLY_ALLOWLISTS.vercel] },
  });
});
