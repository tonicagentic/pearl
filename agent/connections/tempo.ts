import { connect } from "@vercel/connect/eve";
import { defineDynamic, defineMcpClientConnection } from "eve/connections";

import {
  TEMPO_ALLOWLIST,
  TEMPO_WRITE_TOOLS,
} from "../lib/connection-allowlists.js";
import { writeToolApproval } from "../lib/connection-approval.js";
import { toolSurfaceEnabled } from "../lib/lane-state.js";
import { isBetterAuthUserPrincipal } from "../lib/user-connection.js";

// TEMPO_CONNECTOR is the Vercel Connect UID for Tempo's MCP server (Streamable
// HTTP, OAuth via Better Auth's mcp plugin on the CRM app). Create with:
//   vercel connect create "$TEMPO_MCP_URL" --name tempo
// TEMPO_MCP_URL is required (no hardcoded host) so public multi-tenant deploys
// do not silently point at an operator CRM.
// Reads (search, resolve, list_*, read_*_history) run freely; writes need a
// person's approval every call and are denied in plan mode.
export default defineDynamic((ctx) => {
  const connector = process.env.TEMPO_CONNECTOR?.trim();
  const url = process.env.TEMPO_MCP_URL?.trim();
  if (
    !connector ||
    !url ||
    !toolSurfaceEnabled() ||
    !isBetterAuthUserPrincipal(ctx.session.auth.current)
  ) {
    return null;
  }

  return defineMcpClientConnection({
    url,
    description:
      "The signed-in user's company CRM (Tempo): search and resolve people, companies, deals, meetings, and proposals; upsert records, import prospects, log meetings and notes, create tasks and reminders, link activity and proposals, and manage clarifications and offer fits. Writes need approval.",
    instanceKey: `tempo:${connector}`,
    auth: connect({ connector, autoProvision: false }),
    tools: { allow: [...TEMPO_ALLOWLIST] },
    approval: writeToolApproval(TEMPO_WRITE_TOOLS),
  });
});
