import { connect } from "@vercel/connect/eve";
import { defineDynamic, defineMcpClientConnection } from "eve/connections";

import {
  CONNECTION_SHEETS_ALLOWLIST,
  CONNECTION_WRITE_TOOLS,
} from "../lib/connection-allowlists.js";
import { writeToolApproval } from "../lib/connection-approval.js";
import { integrationAllowed } from "../lib/gate-integration.js";
import { toolSurfaceEnabled } from "../lib/lane-state.js";
import { isBetterAuthUserPrincipal } from "../lib/user-connection.js";
import { connectionTokenParams } from "@/lib/connections/oauth-scopes";

const DEFAULT_SHEETS_MCP_URL = "https://sheetsmcp.googleapis.com/mcp/v1";

export default defineDynamic(async (ctx) => {
  const connector = process.env.SHEETS_CONNECTOR?.trim();
  if (
    !connector ||
    !toolSurfaceEnabled() ||
    !isBetterAuthUserPrincipal(ctx.session.auth.current) ||
    !(await integrationAllowed(ctx, "sheets"))
  ) {
    return null;
  }

  return defineMcpClientConnection({
    url: process.env.SHEETS_MCP_URL?.trim() || DEFAULT_SHEETS_MCP_URL,
    description:
      "The signed-in user's Google Sheets: read spreadsheet metadata and cell values, and update values, formulas, structure, and rows or columns (writes need approval). For project-only trackers; company pipeline lives in Tempo.",
    instanceKey: `sheets:${connector}`,
    auth: connect({
      connector,
      autoProvision: false,
      tokenParams: connectionTokenParams("sheets"),
    }),
    tools: { allow: [...CONNECTION_SHEETS_ALLOWLIST] },
    approval: writeToolApproval(CONNECTION_WRITE_TOOLS.sheets),
  });
});
