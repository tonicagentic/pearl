import assert from "node:assert/strict";
import { test } from "node:test";
import { withFileLock } from "../lib/agent/file-mutex.ts";

// The file mutation lock: same-path mutations must serialize (no interleaved
// read-modify-write), different paths must stay parallel, and a failing task
// must not poison the queue for the next waiter.

test("same-path mutations serialize in submission order", async () => {
  const events: string[] = [];
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const first = withFileLock("/workspace/a.md", async () => {
    events.push("first:start");
    await delay(60);
    events.push("first:end");
  });
  const second = withFileLock("/workspace/a.md", async () => {
    events.push("second:start");
    events.push("second:end");
  });

  await Promise.all([first, second]);

  assert.deepEqual(events, [
    "first:start",
    "first:end",
    "second:start",
    "second:end",
  ]);
});

test("different paths run concurrently", async () => {
  let running = 0;
  let overlapped = false;

  const task = () =>
    withFileLock(`/workspace/${Math.random()}.md`, async () => {
      running += 1;
      if (running > 1) overlapped = true;
      await new Promise((r) => setTimeout(r, 40));
      running -= 1;
    });

  await Promise.all([task(), task(), task()]);

  assert.equal(overlapped, true, "different paths must not serialize");
});

test("a failing task does not poison the queue", async () => {
  const results: string[] = [];

  const failing = withFileLock("/workspace/b.md", async () => {
    throw new Error("boom");
  });
  const next = withFileLock("/workspace/b.md", async () => {
    results.push("ran-after-failure");
  });

  await assert.rejects(failing, /boom/);
  await next;

  assert.deepEqual(results, ["ran-after-failure"]);
});
