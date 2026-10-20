import { connect } from "@vercel/connect/eve";
import { defineDynamic, defineMcpClientConnection } from "eve/connections";

export default defineDynamic({
  events: {
    "turn.started": (_event, ctx) => {
      const connector = process.env.NEON_CONNECTOR?.trim();
      const projectId = process.env.NEON_MCP_PROJECT_ID?.trim();
      const role = process.env.NEON_MCP_ROLE?.trim();
      const liveProjectId = process.env.NEON_PROJECT_ID?.trim();
      // A deployed production runtime must never expose the database MCP server.
      if (
        !connector ||
        !projectId ||
        !role ||
        (liveProjectId && projectId === liveProjectId) ||
        ctx.session.auth.current?.principalType !== "user" ||
        ctx.session.auth.current.issuer !== "better-auth" ||
        process.env.VERCEL_ENV === "production" ||
        (!process.env.VERCEL_ENV && process.env.NODE_ENV === "production")
      ) return null;

      const url = new URL("https://mcp.neon.tech/mcp");
      url.searchParams.set("readonly", "true");
      url.searchParams.set("projectId", projectId);
      url.searchParams.set("category", "querying");
      url.searchParams.set("roleName", role);

      return defineMcpClientConnection({
        url: url.toString(),
        description: "Inspect a non-production Neon database with read-only diagnostics only.",
        instanceKey: `neon:${connector}:${projectId}:${role}:readonly`,
        auth: connect({ connector, autoProvision: false }),
        tools: { allow: ["inspect_database"] },
      });
    },
  },
});
