import { connect } from "@vercel/connect/eve";
import { defineDynamic, defineMcpClientConnection } from "eve/connections";

import {
  TEMPO_ALLOWLIST,
  TEMPO_WRITE_TOOLS,
} from "../lib/connection-allowlists.js";
import { writeToolApproval } from "../lib/connection-approval.js";
import { integrationAllowed } from "../lib/gate-integration.js";
import { toolSurfaceEnabled } from "../lib/lane-state.js";
import { isBetterAuthUserPrincipal } from "../lib/user-connection.js";

export default defineDynamic(async (ctx) => {
  const connector = process.env.TEMPO_CONNECTOR?.trim();
  const url = process.env.TEMPO_MCP_URL?.trim();
  if (
    !connector ||
    !url ||
    !toolSurfaceEnabled() ||
    !isBetterAuthUserPrincipal(ctx.session.auth.current) ||
    !(await integrationAllowed(ctx, "tempo"))
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
