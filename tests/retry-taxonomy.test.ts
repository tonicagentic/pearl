import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { TOOL_RETRY_POLICIES, mayAutoRetry, policyFor } from "../lib/agent/retry-policy.ts";

// Part 5 (timeout/retry taxonomy): eve gives authored tools no retry-policy
// primitive ("Authored tools have no public terminal-error class or retry
// policy" — node_modules/eve/docs/tools/overview.mdx), so the declaration
// lives in lib/agent/retry-policy.ts and these tests hold it against the real
// tool files. A tool without a policy fails here rather than silently
// inheriting "safe to retry".

const AGENT_TOOLS_DIR = "agent/tools";

test("every authored tool has a declared retry policy", async () => {
  const files = (await readdir(AGENT_TOOLS_DIR)).filter((f) => f.endsWith(".ts"));
  const missing = files
    .map((f) => f.replace(/\.ts$/, ""))
    .filter((name) => !TOOL_RETRY_POLICIES[name]);

  assert.deepEqual(
    missing,
    [],
    `tools without a retry-policy declaration: ${missing.join(", ")}`,
  );
});

test("destructive tools must never be auto-retried", () => {
  for (const [name, policy] of Object.entries(TOOL_RETRY_POLICIES)) {
    if (/^send_|^delete_|^create_|^update_|^book_|^pay_|^cancel_/.test(name)) {
      assert.equal(
        policy.idempotent,
        false,
        `${name} is destructive: it must not be marked idempotent`,
      );
      assert.deepEqual(
        policy.retryOn,
        [],
        `${name} is destructive: no failure class may be auto-retried`,
      );
      assert.equal(mayAutoRetry(name), false);
      assert.match(policy.rationale, /status check|re-read|double|billed/i);
    }
  }
});

test("idempotent tools declare a bounded attempt count", () => {
  for (const [name, policy] of Object.entries(TOOL_RETRY_POLICIES)) {
    if (policy.idempotent) {
      assert.ok(
        policy.maxAttempts >= 2 && policy.maxAttempts <= 5,
        `${name}: idempotent tools need a sane bounded retry count`,
      );
      assert.ok(policy.retryOn.length > 0, `${name}: declare what may be retried`);
    }
  }
});

test("policyFor covers the tools evals actually drive", async () => {
  // Keep the eval tier and the taxonomy in sync: every tool an eval requires
  // must have a declared policy.
  const evalsSource = await readFile("evals/behavior/hitl-confirmation.eval.ts", "utf8").catch(() => "");
  const referenced = [...evalsSource.matchAll(/calledTool\("([a-z_]+)"\)/g)].map((m) => m[1]);

  for (const toolName of referenced) {
    assert.ok(
      policyFor(toolName),
      `eval drives "${toolName}" but no retry policy is declared`,
    );
  }
});
