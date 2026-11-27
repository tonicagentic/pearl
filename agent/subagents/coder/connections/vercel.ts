import { connect } from "@vercel/connect/eve";
import { defineDynamic, defineMcpClientConnection } from "eve/connections";

import {
  CONNECTION_VERCEL_ALLOWLIST,
  CONNECTION_WRITE_TOOLS,
} from "../../../lib/connection-allowlists.js";
import { writeToolApproval } from "../../../lib/connection-approval.js";
import { isBetterAuthUserPrincipal } from "../../../lib/user-connection.js";

// Same hosted Vercel MCP connector as the parent, mounted on coder with a
// ship-core allowlist (projects, deploys, env, domains, logs). Reads and
// diagnostics run freely; mutating tools need approval every call (same
// HITL path as Expo/Neon). Purchases and credential minting stay omitted.
// Prefer deploy_vercel for sandbox checkout deploys — MCP create_deployment
// is an approved alternative. Full MCP catalog is archived as
// VERCEL_CODER_*_FULL in connection-allowlists.
export default defineDynamic(async (ctx) => {
  const connector = process.env.VERCEL_CONNECTOR?.trim();
  if (!connector || !isBetterAuthUserPrincipal(ctx.session.auth.current)) {
    return null;
  }

  return defineMcpClientConnection({
    url: "https://mcp.vercel.com",
    description:
      "The signed-in user's Vercel account (ship-core): teams, projects, " +
      "deployments, env, domains, and runtime/build logs. Call list_teams " +
      "first, then list_projects for the personal account and every returned " +
      "team (pass teamId or slug), following each page. One list_projects " +
      "call is only one team. To add another team on the same grant, call " +
      "authorize_team_access with that team's id or slug " +
      "(authorize_team_sso when SSO is required), show the returned link, " +
      "then list_teams again after they approve. Do not send them through " +
      "Settings → Update to add a team — that screen replaces the grant " +
      "with one team. Reads and logs are free; creating or changing " +
      "projects, env, domains, aliases, and deployments needs approval. " +
      "Prefer deploy_vercel for the current sandbox checkout. Domain " +
      "purchases, API-key minting, flags, and board tools are not available.",
    instanceKey: `coder:vercel:${connector}`,
    auth: connect({ connector, autoProvision: false }),
    tools: { allow: [...CONNECTION_VERCEL_ALLOWLIST] },
    approval: writeToolApproval(CONNECTION_WRITE_TOOLS.vercel),
  });
});
