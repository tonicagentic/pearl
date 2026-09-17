import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";

// Part 2 (permission creep): the eval tier must run against exactly the
// permission set production ships. This config test fails when:
//   - an eval references a tool production does not have (broader harness), or
//   - a production tool is destructive-patterned but approval-ungated.

const AGENT_TOOLS_DIR = "agent/tools";
const EVALS_DIR = "evals";

// eve's built-in tool surface for this agent (node_modules/eve/docs/
// concepts/built-in-tools.md). Default tools + opt-ins this agent enables.
// Keep in sync with agent/agent.ts and the built-in-tools doc.
const EVE_BUILTIN_TOOLS: ReadonlySet<string> = new Set([
  "bash",
  "read_file",
  "write_file",
  "web_fetch",
  "web_search",
  "todo",
  "ask_question",
  "agent",
  "task_cancel",
  "load_skill",
  "connection_search",
  // eve's fileMemory provider tools (agent/memory/profile.ts) — framework-
  // managed, namespaced by the memory slot name "file".
  "file__save_memory",
  "file__remove_memory",
]);

async function productionTools(): Promise<Set<string>> {
  const files = await readdir(AGENT_TOOLS_DIR);
  return new Set(
    files.filter((f) => f.endsWith(".ts")).map((f) => f.replace(/\.ts$/, "")),
  );
}

async function evalToolReferences(): Promise<Map<string, string[]>> {
  const refs = new Map<string, string[]>();

  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const p = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(p);
      } else if (entry.name.endsWith(".eval.ts")) {
        const source = await readFile(p, "utf8");
        for (const match of source.matchAll(/(?:calledTool|requireToolCall|notCalledTool)\(\s*"([a-z_]+)"/g)) {
          const list = refs.get(match[1]) ?? [];
          list.push(p);
          refs.set(match[1], list);
        }
      }
    }
  }

  await walk(EVALS_DIR);
  return refs;
}

test("evals never reference tools production does not ship", async () => {
  const tools = await productionTools();
  const refs = await evalToolReferences();
  const foreign = [...refs.entries()]
    .filter(([name]) => !tools.has(name) && !EVE_BUILTIN_TOOLS.has(name))
    .map(([name, files]) => `${name} (in ${files[0]})`);

  assert.deepEqual(
    foreign,
    [],
    "evals reference tools the production agent does not ship — the eval harness is broader-scoped than production",
  );
});

test("every production tool referenced by evals exists and is policy-declared", async () => {
  const tools = await productionTools();
  const { TOOL_RETRY_POLICIES } = await import("../lib/agent/retry-policy.ts");
  const refs = await evalToolReferences();

  for (const name of refs.keys()) {
    if (EVE_BUILTIN_TOOLS.has(name)) continue; // framework-managed surface

    assert.ok(tools.has(name), `evals drive "${name}" which production does not ship`);
    assert.ok(
      name in TOOL_RETRY_POLICIES,
      `"${name}" is driven by evals but has no retry-policy declaration`,
    );
  }
});

test("destructive-patterned production tools are approval-gated", async () => {
  const files = await readdir(AGENT_TOOLS_DIR);
  const ungated: string[] = [];

  for (const file of files) {
    if (!file.endsWith(".ts")) continue;
    const name = file.replace(/\.ts$/, "");
    if (!/^send_|^delete_|^create_|^update_|^book_|^pay_|^cancel_|^archive_/.test(name)) continue;

    const source = await readFile(`${AGENT_TOOLS_DIR}/${file}`, "utf8");
    if (!/approval:\s*(always\(\)|once\(\)|\{)/.test(source)) {
      ungated.push(name);
    }
  }

  assert.deepEqual(
    ungated,
    [],
    `destructive tools without a code-level approval gate: ${ungated.join(", ")}`,
  );
});
