import { connect } from "@vercel/connect/eve";
import { defineDynamic, defineMcpClientConnection } from "eve/connections";

import {
  CONNECTION_SHEETS_ALLOWLIST,
  CONNECTION_WRITE_TOOLS,
} from "../lib/connection-allowlists.js";
import { writeToolApproval } from "../lib/connection-approval.js";
import { isBetterAuthUserPrincipal } from "../lib/user-connection.js";
import { connectionTokenParams } from "@/lib/connections/oauth-scopes";

// SHEETS_CONNECTOR is the Vercel Connect UID for the Google Sheets Workspace
// MCP (developer preview). Enable the Google Sheets API and the Google Sheets
// MCP API (sheetsmcp.googleapis.com) in Google Cloud, then create with:
//   vercel connect create "$SHEETS_MCP_URL" --name sheets
// SHEETS_MCP_URL overrides the default endpoint if Google moves it. The
// server has no create-spreadsheet tool: new sheets are made in Google Sheets
// (or Drive) and edited here. Reads run freely; writes need approval each call
// and are denied in plan mode.
const DEFAULT_SHEETS_MCP_URL = "https://sheetsmcp.googleapis.com/mcp/v1";

export default defineDynamic((ctx) => {
  const connector = process.env.SHEETS_CONNECTOR?.trim();
  if (!connector || !isBetterAuthUserPrincipal(ctx.session.auth.current)) {
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
