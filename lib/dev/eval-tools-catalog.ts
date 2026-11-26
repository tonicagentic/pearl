import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  CONNECTION_BETTERSTACK_ALLOWLIST,
  CONNECTION_EXPO_ALLOWLIST,
  CONNECTION_NEON_ALLOWLIST,
  CONNECTION_READONLY_ALLOWLISTS,
  CONNECTION_SHEETS_ALLOWLIST,
  CONNECTION_VERCEL_ALLOWLIST,
  CONNECTION_WRITE_BLOCKLISTS,
  TEMPO_ALLOWLIST,
} from "@/agent/lib/connection-allowlists";
import { agentMeta, loadEvalCatalog } from "@/lib/dev/eval-catalog";
import type {
  ToolsCatalogAgent,
  ToolsCatalogEvalRef,
  ToolsCatalogTool,
  ToolsCatalogToolKind,
} from "@/lib/dev/eval-tools-catalog-types";

export type {
  ToolsCatalogAgent,
  ToolsCatalogEvalRef,
  ToolsCatalogTool,
  ToolsCatalogToolKind,
} from "@/lib/dev/eval-tools-catalog-types";

const ROOT = process.cwd();
const AGENT_DIR = path.join(ROOT, "agent");
const SUBAGENTS_DIR = path.join(AGENT_DIR, "subagents");
const ROOT_TOOLS_DIR = path.join(AGENT_DIR, "tools");
const ROOT_CONNECTIONS_DIR = path.join(AGENT_DIR, "connections");

/**
 * Framework defaults every eve agent sees unless replaced/disabled.
 * Keep aligned with tests/permission-parity.test.ts.
 */
const EVE_BUILTIN_TOOLS: readonly {
  name: string;
  description: string;
}[] = [
  { name: "bash", description: "Run shell commands in the agent sandbox." },
  { name: "read_file", description: "Read a file from the workspace." },
  { name: "write_file", description: "Write a file in the workspace." },
  { name: "web_fetch", description: "Fetch a URL and return page text." },
  { name: "web_search", description: "Search the open web (harness default)." },
  { name: "todo", description: "Track multi-step work in-session." },
  { name: "ask_question", description: "Ask the user a structured question." },
  { name: "agent", description: "Spawn a generic child agent task." },
  { name: "task_cancel", description: "Cancel a running child task." },
  { name: "load_skill", description: "Load a skill into context." },
  {
    name: "connection_search",
    description: "Search available connection tools.",
  },
  {
    name: "file__save_memory",
    description: "Save a memory item (file memory provider).",
  },
  {
    name: "file__remove_memory",
    description: "Remove a memory item (file memory provider).",
  },
];

function assertDev(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Tools catalog is only available in development.");
  }
}

function listTsBasenames(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".d.ts"))
    .map((name) => name.replace(/\.ts$/, ""))
    .sort();
}

function listSubagentIds(): string[] {
  if (!existsSync(SUBAGENTS_DIR)) return [];
  return readdirSync(SUBAGENTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

function extractDescription(source: string): string {
  const block = source.slice(0, 4_000);
  const match = block.match(
    /\bdescription\s*:\s*((?:`(?:\\`|[^`])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\+\s*)+)/,
  );
  if (!match) return "";
  const parts = [...match[1]!.matchAll(/`((?:\\`|[^`])*)`|"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'/g)];
  if (parts.length === 0) return "";
  return parts
    .map((part) => (part[1] ?? part[2] ?? part[3] ?? "").replace(/\\n/g, " ").replace(/\\"/g, '"'))
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
}

/**
 * Side-effect hooks that never expose a model-facing tool (e.g. sync turn
 * intent then `return null`). Skip these in the Tools catalog.
 */
function isNullOnlyToolModule(name: string, source: string): boolean {
  if (name === "sync_turn_intent") return true;
  const hasDefineTool = /\bdefineTool\s*\(/.test(source);
  const returnsNull = /return\s+null\s*;/.test(source);
  const isDynamic = /\bdefineDynamic\s*\(/.test(source);
  return isDynamic && returnsNull && !hasDefineTool;
}

function authoredTool(
  name: string,
  filePath: string,
  origin: string,
): Omit<ToolsCatalogTool, "evals"> | null {
  let source = "";
  try {
    source = readFileSync(filePath, "utf8");
  } catch {
    // ignore
  }
  if (source && isNullOnlyToolModule(name, source)) return null;
  const description = source ? extractDescription(source) : "";
  return {
    name,
    kind: "authored",
    origin,
    description: description || `First-party tool (${origin}).`,
  };
}

function connectionToolNames(
  agentId: string,
  connectionId: string,
): {
  readonly mode: "allow" | "block";
  readonly names: readonly string[];
} | null {
  switch (connectionId) {
    case "vercel":
      return {
        mode: "allow",
        names:
          agentId === "coder"
            ? CONNECTION_VERCEL_ALLOWLIST
            : CONNECTION_READONLY_ALLOWLISTS.vercel,
      };
    case "betterstack":
      return {
        mode: "allow",
        names:
          agentId === "coder"
            ? CONNECTION_BETTERSTACK_ALLOWLIST
            : CONNECTION_READONLY_ALLOWLISTS.betterstack,
      };
    case "expo":
      return { mode: "allow", names: CONNECTION_EXPO_ALLOWLIST };
    case "neon":
      return { mode: "allow", names: CONNECTION_NEON_ALLOWLIST };
    case "sheets":
      return { mode: "allow", names: CONNECTION_SHEETS_ALLOWLIST };
    case "tempo":
      return { mode: "allow", names: TEMPO_ALLOWLIST };
    case "calendar":
    case "drive":
    case "github":
      return {
        mode: "allow",
        names: CONNECTION_READONLY_ALLOWLISTS[connectionId],
      };
    case "xero":
      return {
        mode: "block",
        names: CONNECTION_WRITE_BLOCKLISTS.xero,
      };
    default:
      if (
        connectionId in CONNECTION_READONLY_ALLOWLISTS &&
        Array.isArray(
          CONNECTION_READONLY_ALLOWLISTS[
            connectionId as keyof typeof CONNECTION_READONLY_ALLOWLISTS
          ],
        )
      ) {
        return {
          mode: "allow",
          names:
            CONNECTION_READONLY_ALLOWLISTS[
              connectionId as keyof typeof CONNECTION_READONLY_ALLOWLISTS
            ],
        };
      }
      return null;
  }
}

function toolsForAgent(agentId: string): Omit<ToolsCatalogTool, "evals">[] {
  const byName = new Map<string, Omit<ToolsCatalogTool, "evals">>();

  const toolsDir =
    agentId === "pearl"
      ? ROOT_TOOLS_DIR
      : path.join(SUBAGENTS_DIR, agentId, "tools");
  const toolsOrigin =
    agentId === "pearl"
      ? "agent/tools"
      : `agent/subagents/${agentId}/tools`;

  for (const name of listTsBasenames(toolsDir)) {
    const tool = authoredTool(
      name,
      path.join(toolsDir, `${name}.ts`),
      `${toolsOrigin}/${name}.ts`,
    );
    if (tool) byName.set(name, tool);
  }

  // Harness defaults when not replaced by an authored file.
  for (const builtin of EVE_BUILTIN_TOOLS) {
    if (byName.has(builtin.name)) continue;
    byName.set(builtin.name, {
      name: builtin.name,
      kind: "builtin",
      origin: "eve harness default",
      description: builtin.description,
    });
  }

  if (agentId === "pearl") {
    for (const id of listSubagentIds()) {
      byName.set(id, {
        name: id,
        kind: "subagent",
        origin: `agent/subagents/${id}/`,
        description:
          agentMeta(id).description ||
          `Declared subagent — delegate via the \`${id}\` tool.`,
      });
    }
  }

  const connectionsDir =
    agentId === "pearl"
      ? ROOT_CONNECTIONS_DIR
      : path.join(SUBAGENTS_DIR, agentId, "connections");

  for (const connectionId of listTsBasenames(connectionsDir)) {
    const resolved = connectionToolNames(agentId, connectionId);
    if (!resolved) {
      byName.set(`connection:${connectionId}`, {
        name: connectionId,
        kind: "connection",
        connectionId,
        origin: `connection:${connectionId}`,
        description: `MCP connection \`${connectionId}\` (tool list unknown).`,
      });
      continue;
    }

    if (resolved.mode === "block") {
      byName.set(`connection:${connectionId}`, {
        name: `${connectionId} (MCP)`,
        kind: "connection",
        connectionId,
        origin: `connection:${connectionId} (write-blocked)`,
        description:
          `Read-oriented MCP for ${connectionId}. Blocked writes: ` +
          `${resolved.names.slice(0, 8).join(", ")}` +
          (resolved.names.length > 8 ? "…" : ""),
      });
      continue;
    }

    for (const name of resolved.names) {
      const key = `${connectionId}:${name}`;
      if (byName.has(name) || byName.has(key)) continue;
      byName.set(key, {
        name,
        kind: "connection",
        connectionId,
        origin: `connection:${connectionId}`,
        description: `MCP tool from the ${connectionId} connection.`,
      });
    }
  }

  return [...byName.values()].sort((a, b) => {
    const kindOrder: Record<ToolsCatalogToolKind, number> = {
      subagent: 0,
      authored: 1,
      connection: 2,
      builtin: 3,
    };
    const kindDiff = kindOrder[a.kind] - kindOrder[b.kind];
    if (kindDiff !== 0) return kindDiff;
    if (a.connectionId && b.connectionId && a.connectionId !== b.connectionId) {
      return a.connectionId.localeCompare(b.connectionId);
    }
    return a.name.localeCompare(b.name);
  });
}

function buildToolEvalIndexFromSuites(
  suites: ReturnType<typeof loadEvalCatalog>,
): Map<string, ToolsCatalogEvalRef[]> {
  const index = new Map<string, ToolsCatalogEvalRef[]>();

  for (const suite of suites) {
    for (const item of suite.evals) {
      const byTool = new Map<string, string[]>();
      for (const assertion of item.assertions) {
        if (assertion.kind !== "gate") continue;
        const match = assertion.name.match(
          /^(?:calledTool|notCalledTool|requireToolCall)\((.+)\)$/,
        );
        if (!match) continue;
        const toolName = match[1]!;
        const gates = byTool.get(toolName) ?? [];
        gates.push(assertion.name);
        byTool.set(toolName, gates);
      }
      for (const [toolName, gates] of byTool) {
        const list = index.get(toolName) ?? [];
        list.push({
          id: item.id,
          suite: suite.id,
          name: item.name,
          description: item.description,
          gates: [...new Set(gates)],
        });
        index.set(toolName, list);
      }
    }
  }

  return index;
}

/** Agents that have a folder (or Pearl) — includes specialists with no evals yet. */
function catalogAgentIds(
  suiteAgents: readonly string[],
): string[] {
  const ids = new Set<string>(["pearl", ...listSubagentIds(), ...suiteAgents]);
  return [...ids].sort((a, b) => {
    if (a === "pearl") return -1;
    if (b === "pearl") return 1;
    return a.localeCompare(b);
  });
}

export function loadToolsCatalog(): ToolsCatalogAgent[] {
  assertDev();
  const suites = loadEvalCatalog();
  const evalIndex = buildToolEvalIndexFromSuites(suites);
  const evalCountByAgent = new Map<string, number>();
  for (const suite of suites) {
    evalCountByAgent.set(
      suite.agent,
      (evalCountByAgent.get(suite.agent) ?? 0) + suite.evals.length,
    );
  }

  return catalogAgentIds(suites.map((suite) => suite.agent)).map((id) => {
    const meta = agentMeta(id);
    const baseTools = toolsForAgent(id);
    const tools: ToolsCatalogTool[] = baseTools.map((tool) => ({
      ...tool,
      evals: evalIndex.get(tool.name) ?? [],
    }));
    const coveredToolCount = tools.filter((tool) => tool.evals.length > 0).length;
    return {
      id: meta.id,
      label: meta.label,
      description: meta.description,
      tools,
      coveredToolCount,
      toolCount: tools.length,
      evalCount: evalCountByAgent.get(id) ?? 0,
    };
  });
}
