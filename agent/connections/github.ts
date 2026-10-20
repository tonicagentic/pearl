import { connect } from "@vercel/connect/eve";
import { defineDynamic, defineMcpClientConnection } from "eve/connections";

export default defineDynamic({
  events: {
    "turn.started": (_event, ctx) => {
      const connector = process.env.GITHUB_CONNECTOR?.trim();
      if (!connector || ctx.session.auth.current?.principalType !== "user" ||
        ctx.session.auth.current.issuer !== "better-auth") return null;

      return defineMcpClientConnection({
        url: "https://api.githubcopilot.com/mcp/readonly",
        description: "Read GitHub repositories, files, issues, and pull requests; no writes.",
        instanceKey: `github:${connector}:readonly`,
        auth: connect({ connector, autoProvision: false }),
        headers: { "X-MCP-Toolsets": "repos,issues,pull_requests" },
        tools: {
          allow: ["search_repositories", "get_file_contents", "issue_read", "pull_request_read"],
        },
      });
    },
  },
});
