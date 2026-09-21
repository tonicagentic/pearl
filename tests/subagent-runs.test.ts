import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deriveSubagentRuns,
  STALE_REVIEW_S,
} from "../lib/agent/subagent-runs.ts";

// Real event shapes (from chat_event rows):
const CALLED = {
  type: "subagent.called",
  meta: { at: "2026-09-20T19:59:57.551Z" },
  data: {
    name: "editor",
    callId: "chatcmpl-tool-editor",
    toolName: "editor",
    childSessionId: "wrun_child",
  },
};

const RECEIPT = {
  // The tool call returning its working receipt (background task admitted).
  type: "subagent.completed",
  meta: { at: "2026-09-20T19:28:09.609Z" },
  data: {
    subagentName: "editor",
    callId: "chatcmpl-tool-editor",
    output: { agentId: "ag_editor:x", status: "working", taskId: "task_x" },
    backgroundTask: { status: "working", taskId: "task_x" },
  },
};

const FINAL_COMPLETION = {
  // The child finishing with its structured review.
  type: "subagent.completed",
  meta: { at: "2026-09-20T20:01:00.000Z" },
  data: {
    name: "editor",
    output: {
      overall: "solid",
      coherence: { score: 8, issues: [] },
      flow: { score: 7, issues: [] },
      audienceFit: { score: 9, audience: "engineers", issues: [] },
    },
  },
};

const AT = Date.parse(CALLED.meta.at);

test("a delegation call produces a running run", () => {
  const runs = deriveSubagentRuns([CALLED], AT + 5_000);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].state, "running");
  assert.equal(runs[0].name, "editor");
});

test("the working receipt also starts a run, deduped by callId", () => {
  const called10sLater = {
    ...CALLED,
    meta: { at: "2026-09-20T19:28:19.609Z" },
  };
  const runs = deriveSubagentRuns(
    [RECEIPT, called10sLater],
    Date.parse(called10sLater.meta.at) + 5_000,
  );
  assert.equal(runs.length, 1, "called and receipt are the same delegation");
  assert.equal(runs[0].state, "running");
});

test("final completion flips the run to ready with the review scores", () => {
  const runs = deriveSubagentRuns(
    [CALLED, FINAL_COMPLETION],
    Date.parse(FINAL_COMPLETION.meta.at) + 1_000,
  );
  assert.equal(runs[0].state, "ready");
  const review = runs[0].result as { coherence: { score: number } };
  assert.equal(review.coherence.score, 8);
});

test("a run with no completion past the stale bound is failed", () => {
  const now = AT + (STALE_REVIEW_S + 60) * 1000;
  const runs = deriveSubagentRuns([CALLED], now);
  assert.equal(runs[0].state, "failed");
});

test("an interrupted receipt (no child started) also goes failed when stale", () => {
  const now = Date.parse(RECEIPT.meta.at) + (STALE_REVIEW_S + 60) * 1000;
  const runs = deriveSubagentRuns([RECEIPT], now);
  assert.equal(runs[0].state, "failed");
});

test("a late completion recovers a stale run back to ready", () => {
  const lateCompletion = {
    ...FINAL_COMPLETION,
    meta: { at: "2026-09-20T20:35:00.000Z" },
  };
  const runs = deriveSubagentRuns(
    [CALLED, lateCompletion],
    Date.parse(lateCompletion.meta.at) + 1_000,
  );
  assert.equal(runs[0].state, "ready");
  assert.equal((runs[0].result as { overall: string }).overall, "solid");
});

test("a fresh run is not marked failed before the stale bound", () => {
  const now = AT + (STALE_REVIEW_S - 60) * 1000;
  const runs = deriveSubagentRuns([CALLED], now);
  assert.equal(runs[0].state, "running");
});

test("runs without a matching name are not completed by another subagent", () => {
  const otherDone = {
    ...FINAL_COMPLETION,
    data: { name: "other", output: { overall: "x" } },
  };
  const runs = deriveSubagentRuns([CALLED, otherDone], AT + 5_000);
  assert.equal(runs[0].state, "running");
});
