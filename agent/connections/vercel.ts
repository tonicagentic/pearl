import { connect } from "@vercel/connect/eve";
import { defineDynamic, defineMcpClientConnection } from "eve/connections";

export default defineDynamic({
  events: {
    "turn.started": (_event, ctx) => {
      const connector = process.env.VERCEL_CONNECTOR?.trim();
      const teamId = process.env.VERCEL_MCP_TEAM_ID?.trim();
      const projectId = process.env.VERCEL_MCP_PROJECT_ID?.trim();
      if (
        !connector ||
        !teamId ||
        !projectId ||
        ctx.session.auth.current?.principalType !== "user" ||
        ctx.session.auth.current.issuer !== "better-auth"
      ) return null;

      return defineMcpClientConnection({
        url: "https://mcp.vercel.com",
        description: "List deployment metadata for the configured Vercel project; no logs or changes.",
        instanceKey: `vercel:${connector}:${teamId}:${projectId}`,
        auth: connect({ connector, autoProvision: false }),
        toolCall: {
          providedArguments: { teamId, projectId },
        },
        tools: {
          // Logs can contain secrets and request data. Add them only after
          // approval prompts also work on mobile.
          // get_project's alternate idOrName selector is not safely pinned by
          // projectId. Do not expose it until its live schema is verified.
          allow: ["list_deployments"],
        },
      });
    },
  },
});
