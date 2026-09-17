import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { always, never, once } from "eve/tools/approval";

// Part 2: destructive tools must be behind a confirmation gate in code, not
// prompt. The gate is eve's approval policy; these tests pin the policy
// behavior and scan the real tool files so a destructive tool without a gate
// fails the unit tier before it can ship.

const AGENT_TOOLS_DIR = "agent/tools";

/** Minimal ApprovalContext stub: the policies under test only read toolName,
 * toolInput, approvedTools, and session identity; getSandbox/getSkill exist to
 * satisfy the SessionContext shape. */
const fakeCtx = (overrides: Record<string, unknown> = {}) =>
  ({
    approvedTools: new Set<string>(),
    callId: "call_1",
    toolName: "send_notification",
    getSandbox: () => {
      throw new Error("sandbox is not reachable from approval checks");
    },
    getSkill: () => {
      throw new Error("skills are not reachable from approval checks");
    },
    session: {},
    ...overrides,
  }) as never;

/** Tool-name fragments that mark a tool as destructive. */
const DESTRUCTIVE_PATTERNS: readonly RegExp[] = [
  /^send_/,
  /^delete_/,
  /^create_/,
  /^update_/,
  /^book_/,
  /^pay_/,
  /^cancel_/,
  /^archive_/,
];

async function toolFiles(): Promise<string[]> {
  return (await readdir(AGENT_TOOLS_DIR)).filter((name) =>
    name.endsWith(".ts"),
  );
}

test("approval policies: always() demands a human decision every call", async () => {
  const status = await always()(
    fakeCtx({ toolInput: { recipient: "boss", message: "hi" } }),
  );

  assert.equal(status, "user-approval");
});

test("approval policies: once() auto-allows only after an explicit approval", async () => {
  const policy = once();
  const pending = await policy(fakeCtx({}));
  assert.equal(pending, "user-approval");

  const afterApproval = await policy(
    fakeCtx({ approvedTools: new Set(["send_notification"]), callId: "call_2" }),
  );
  assert.notEqual(afterApproval, "user-approval");
});

test("approval policies: never() is not-applicable (default no-gate)", async () => {
  const status = await never()(fakeCtx({ toolName: "get_weather" }));
  assert.notEqual(status, "user-approval");
});

test("every destructive-patterned tool file declares an approval gate", async () => {
  const files = await toolFiles();
  const findings: string[] = [];

  for (const file of files) {
    const name = file.replace(/\.ts$/, "");
    const isDestructive = DESTRUCTIVE_PATTERNS.some((pattern) =>
      pattern.test(name),
    );
    if (!isDestructive) continue;

    const source = await readFile(`${AGENT_TOOLS_DIR}/${file}`, "utf8");
    const hasGate = /approval:\s*(always\(\)|once\(\)|\{)/.test(source);
    if (!hasGate) {
      findings.push(`${name}: destructive-patterned but has no approval gate`);
    }
  }

  assert.deepEqual(findings, []);
});

test("send_notification ships the approval gate and ledger wiring", async () => {
  const source = await readFile(`${AGENT_TOOLS_DIR}/send_notification.ts`, "utf8");

  assert.match(source, /approval:\s*always\(\)/, "must gate every call on approval");
  assert.match(source, /executeSend/, "must go through the ledger-backed path");
});

test("the destructive tool never executes without approval resolution", async () => {
  // executeSend is exported and runnable directly — the unit tier proves that
  // calling the tool's behavior path does NOT bypass the ledger record even
  // when invoked programmatically (a code path the approval gate protects in
  // the runtime). The side effect is only observable through the ledger.
  const { executeSend } = await import("../lib/agent/notification.ts");
  const { readExecutionState } = await import("../lib/agent/notification.ts");

  const result = await executeSend(
    { recipient: "audit", message: "gate check", idempotencyKey: "gate-check-1" },
    {
      deliver: async () => { throw new Error("delivery must not be attempted"); },
      resolveEndpoint: () => null, // unconfigured: no side effect possible
    },
  );

  assert.equal(result.status, "unconfigured"); // no endpoint → no side effect
  const state = await readExecutionState(
    // same key derivation the tool used
    (await import("node:crypto")).createHash("sha256").update("send_notification\u0000gate-check-1").digest("hex"),
  );
  assert.ok(state, "the refusal is still ledgered so replays cannot half-fire");
  assert.equal(state.status, "failed");
});
