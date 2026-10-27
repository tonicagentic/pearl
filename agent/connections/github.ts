import { connect } from "@vercel/connect/eve";
import { defineDynamic, defineMcpClientConnection } from "eve/connections";

import { CONNECTION_READONLY_ALLOWLISTS } from "../lib/connection-allowlists.js";
import { isBetterAuthUserPrincipal } from "../lib/user-connection.js";
import { connectionTokenParams } from "@/lib/connections/oauth-scopes";

// GITHUB_CONNECTOR is the Vercel Connect UID for the hosted GitHub Copilot
// MCP OAuth connector (not the managed GitHub App). Create against the
// readonly MCP URL with userAuthorization + GitHub OAuth discovery — a bare
// clientId/clientSecret create does not support user grants.
export default defineDynamic({
  events: {
    "turn.started": (_event, ctx) => {
      const connector = process.env.GITHUB_CONNECTOR?.trim();
      if (!connector || !isBetterAuthUserPrincipal(ctx.session.auth.current)) {
        return null;
      }

      return defineMcpClientConnection({
        url: "https://api.githubcopilot.com/mcp/readonly",
        description:
          "Read the signed-in user's GitHub repositories, files, issues, and pull requests; no writes.",
        instanceKey: `github:${connector}:readonly`,
        auth: connect({
          connector,
          autoProvision: false,
          tokenParams: connectionTokenParams("github"),
        }),
        headers: { "X-MCP-Toolsets": "repos,issues,pull_requests" },
        tools: { allow: [...CONNECTION_READONLY_ALLOWLISTS.github] },
      });
    },
  },
});
