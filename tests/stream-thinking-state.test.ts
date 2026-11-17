import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createThinkingStateDweller,
  deriveLiveThinkingState,
  extractPartialArgString,
  extractReasoningHeading,
  THINKING_STATE_DWELL_MS,
} from "../lib/stream-thinking-state.ts";
import { chipForTool, statusLabelForTool } from "../lib/thread-activity.ts";

describe("extractReasoningHeading", () => {
  it("prefers the latest markdown heading", () => {
    assert.equal(
      extractReasoningHeading(
        "Warmup.\n\n**Gather sources**\nnotes\n\n**Draft outline**\nmore",
      ),
      "Draft outline",
    );
  });

  it("falls back to a short leading clause", () => {
    assert.equal(
      extractReasoningHeading(
        "Checking the calendar for conflicts before proposing times.",
      ),
      "Checking the calendar for conflicts before…",
    );
  });

  it("returns null for empty text", () => {
    assert.equal(extractReasoningHeading("   "), null);
  });
});

describe("extractPartialArgString / chipForTool streaming", () => {
  it("pulls string fields from partial JSON", () => {
    const argsText = '{"filePath":"/repo/notes.md","offset":';
    assert.equal(extractPartialArgString(argsText, "filePath"), "/repo/notes.md");
    assert.equal(
      chipForTool({
        type: "tool-call",
        toolName: "read_file",
        args: {},
        argsText,
        status: { type: "running" },
      }),
      "notes.md",
    );
  });

  it("prefers call.progress label in statusLabelForTool", () => {
    assert.equal(
      statusLabelForTool({
        type: "tool-call",
        toolName: "exa_agent_run",
        args: { query: "acme" },
        label: "Researching Acme funding",
        status: { type: "running" },
      }),
      "Researching Acme funding",
    );
  });
});

describe("deriveLiveThinkingState", () => {
  it("shows waiting label before content", () => {
    const state = deriveLiveThinkingState({
      statusType: "running",
      waitingLabel: "Planning next steps",
      events: [{ type: "turn.started" }, { type: "model.started" }],
      parts: [],
    });
    assert.equal(state.phase, "pre-content");
    assert.equal(state.label, "Planning next steps");
  });

  it("surfaces reasoning headings", () => {
    const state = deriveLiveThinkingState({
      statusType: "running",
      parts: [{ type: "reasoning", text: "**Check inbox**\nLooking…" }],
    });
    assert.equal(state.phase, "reasoning");
    assert.equal(state.label, "Check inbox");
  });

  it("surfaces streaming tool chips from argsText", () => {
    const state = deriveLiveThinkingState({
      statusType: "running",
      parts: [
        {
          type: "tool-call",
          toolName: "web_search",
          args: {},
          argsText: '{"query":"pearl agent"}',
          status: { type: "running" },
        },
      ],
    });
    assert.equal(state.phase, "tool");
    assert.match(state.label ?? "", /pearl agent/);
  });

  it("prefers call.progress labels from events", () => {
    const state = deriveLiveThinkingState({
      statusType: "running",
      events: [
        { type: "call.started", data: { callId: "c1" } },
        {
          type: "call.progress",
          data: { callId: "c1", label: "Browsing docs.exa.ai" },
        },
      ],
      parts: [
        {
          type: "tool-call",
          toolName: "browser",
          status: { type: "running" },
        },
      ],
    });
    assert.equal(state.label, "Browsing docs.exa.ai");
  });

  it("reports compaction and retry phases", () => {
    assert.equal(
      deriveLiveThinkingState({
        statusType: "running",
        events: [{ type: "context.started" }],
      }).label,
      "Summarizing earlier context",
    );
    assert.equal(
      deriveLiveThinkingState({
        statusType: "running",
        events: [{ type: "model.retried" }],
      }).label,
      "Retrying model",
    );
  });

  it("yields when answer prose is active", () => {
    const state = deriveLiveThinkingState({
      statusType: "running",
      answerPhase: true,
      parts: [{ type: "text", text: "Here is the plan." }],
    });
    assert.equal(state.label, undefined);
  });
});

describe("createThinkingStateDweller", () => {
  it("holds intermediate labels for the dwell window", () => {
    let t = 0;
    const dwell = createThinkingStateDweller({
      dwellMs: THINKING_STATE_DWELL_MS,
      now: () => t,
    });
    assert.equal(dwell.next("Thinking"), "Thinking");
    t += 100;
    assert.equal(dwell.next("Check inbox"), "Thinking");
    t += THINKING_STATE_DWELL_MS;
    assert.equal(dwell.flush(), "Check inbox");
  });

  it("skips transient labels when the stream outruns the hold", () => {
    let t = 0;
    const dwell = createThinkingStateDweller({
      dwellMs: THINKING_STATE_DWELL_MS,
      now: () => t,
    });
    assert.equal(dwell.next("A"), "A");
    t += 50;
    assert.equal(dwell.next("B"), "A");
    t += 50;
    assert.equal(dwell.next("C"), "A");
    assert.equal(dwell.peek(), "A");
    t += THINKING_STATE_DWELL_MS;
    assert.equal(dwell.flush(), "C");
  });

  it("clears immediately on undefined", () => {
    const dwell = createThinkingStateDweller({ now: () => 0 });
    dwell.next("Thinking");
    assert.equal(dwell.next(undefined), undefined);
  });
});
