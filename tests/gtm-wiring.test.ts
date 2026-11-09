import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

/**
 * Static smoke for the GTM + Tempo + Sheets + Gmail compose/send wiring.
 * Live Connect OAuth still needs a deployed Tempo MCP and connector UIDs.
 */
test("GTM skill pack and instructions are present", async () => {
  const skills = [
    "agent/skills/gtm/SKILL.md",
    "agent/skills/offer-discovery/SKILL.md",
    "agent/skills/market-positioning/SKILL.md",
    "agent/skills/pricing-and-terms/SKILL.md",
    "agent/skills/outreach-and-messaging/SKILL.md",
    "agent/skills/events-and-meetings/SKILL.md",
    "agent/instructions/gtm.md",
    "evals/gtm/skill-routing.eval.ts",
  ];
  for (const path of skills) {
    const body = await readFile(path, "utf8");
    assert.ok(body.length > 100, `${path} should have content`);
  }

  const instructions = await readFile("agent/instructions.md", "utf8");
  assert.match(instructions, /\bgtm\b/i);

  const outreach = await readFile(
    "agent/skills/outreach-and-messaging/SKILL.md",
    "utf8",
  );
  assert.match(outreach, /Sheets playbook/);
  assert.match(outreach, /write_file/);
  assert.match(outreach, /Tempo/);
});

test("Tempo, Sheets, and Gmail compose connections are registered", async () => {
  const files = await readdir("agent/connections");
  assert.ok(files.includes("tempo.ts"));
  assert.ok(files.includes("sheets.ts"));
  assert.ok(files.includes("gmail.ts"));

  const catalog = await readFile("lib/connections/catalog.ts", "utf8");
  assert.match(catalog, /"tempo"/);
  assert.match(catalog, /"sheets"/);
  assert.match(catalog, /TEMPO_CONNECTOR/);
  assert.match(catalog, /SHEETS_CONNECTOR/);

  const tempo = await readFile("agent/connections/tempo.ts", "utf8");
  assert.match(tempo, /crm\.tonicagentic\.com\/api\/mcp/);
  assert.match(tempo, /TEMPO_WRITE_TOOLS/);
  assert.match(tempo, /writeToolApproval/);

  const sheets = await readFile("agent/connections/sheets.ts", "utf8");
  assert.match(sheets, /sheetsmcp\.googleapis\.com/);
  assert.match(sheets, /writeToolApproval/);

  const gmail = await readFile("agent/connections/gmail.ts", "utf8");
  assert.match(gmail, /CONNECTION_COMPOSE_ALLOWLISTS/);
  assert.match(gmail, /send_gmail_message/);
  assert.match(gmail, /writeToolApproval/);

  const allowlists = await readFile(
    "agent/lib/connection-allowlists.ts",
    "utf8",
  );
  assert.match(allowlists, /create_draft/);
  assert.match(allowlists, /TEMPO_ALLOWLIST/);
});

test("send_gmail_message tool ships with always-approval and ledger", async () => {
  const tool = await readFile("agent/tools/send_gmail_message.ts", "utf8");
  assert.match(tool, /approval:\s*\{[\s\S]*always\(\)/);
  assert.match(tool, /isPlanMode/);
  assert.match(tool, /executeGmailSend/);

  const send = await readFile("lib/agent/gmail-send.ts", "utf8");
  assert.match(send, /beginExecution/);
});
