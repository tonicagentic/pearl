import { connect } from "@vercel/connect/eve";
import { defineDynamic, defineMcpClientConnection } from "eve/connections";

import {
  CONNECTION_VERCEL_ALLOWLIST,
  CONNECTION_WRITE_TOOLS,
} from "../../../lib/connection-allowlists.js";
import { writeToolApproval } from "../../../lib/connection-approval.js";
import { isBetterAuthUserPrincipal } from "../../../lib/user-connection.js";

// Same hosted Vercel MCP connector as the parent, mounted on coder with
// near-full tool access. Reads and diagnostics run freely; mutating tools
// need approval every call (same HITL path as Expo/Neon). Purchases and
// credential minting stay omitted. Prefer deploy_vercel for sandbox
// checkout deploys — MCP create_deployment is an approved alternative.
export default defineDynamic(async (ctx) => {
  const connector = process.env.VERCEL_CONNECTOR?.trim();
  if (!connector || !isBetterAuthUserPrincipal(ctx.session.auth.current)) {
    return null;
  }

  return defineMcpClientConnection({
    url: "https://mcp.vercel.com",
    description:
      "The signed-in user's Vercel account: teams, projects, deployments, " +
      "env, domains, logs, and ops. Call list_teams first, then " +
      "list_projects for the personal account and every returned team " +
      "(pass teamId or slug), following each page. One list_projects call " +
      "is only one team. Reads and runtime/build logs are free; creating " +
      "or changing projects, env, domains, aliases, and deployments needs " +
      "approval. Prefer deploy_vercel for the current sandbox checkout. " +
      "Domain purchases and API-key minting are not available.",
    instanceKey: `coder:vercel:${connector}`,
    auth: connect({ connector, autoProvision: false }),
    tools: { allow: [...CONNECTION_VERCEL_ALLOWLIST] },
    approval: writeToolApproval(CONNECTION_WRITE_TOOLS.vercel),
  });
});
