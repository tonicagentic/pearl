import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyPearlHeuristic,
  waitingLabelForText,
} from "../lib/pearl-lane.ts";
import {
  CODER_TIERS,
} from "../agent/subagents/coder/model-router.ts";
import {
  PEARL_LANES,
  PEARL_SPECIALIST_THRESHOLD,
  laneFromDecisionAnswer,
  modelForLane,
  resolvePinnedModelForStep,
} from "../agent/model-router.ts";
import { nextRevealLength } from "../mobile/src/stream-presentation.ts";
import {
  AUTO_MODEL_KEY,
  CLIENT_MODEL_KEYS,
  MODEL_SELECTION_MARKER,
  readClientModelSelection,
} from "../agent/model-selection.ts";

function markerMessage(key: string) {
  return {
    role: "user",
    kind: "context.instruction",
    content: `Client context:\n${JSON.stringify({ [MODEL_SELECTION_MARKER]: key })}`,
  };
}

describe("classifyPearlHeuristic", () => {
  it("routes short chat to voice", () => {
    assert.equal(classifyPearlHeuristic("hey, what do you think?"), "voice");
  });

  it("routes calendar and mail cues to tools", () => {
    assert.equal(
      classifyPearlHeuristic("What's on my calendar tomorrow?"),
      "tools",
    );
    assert.equal(
      classifyPearlHeuristic("Check my gmail for the invoice"),
      "tools",
    );
  });

  it("routes document and analysis cues to analysis", () => {
    assert.equal(
      classifyPearlHeuristic("Summarize this contract for diligence"),
      "analysis",
    );
    assert.equal(
      classifyPearlHeuristic("Analyze the financial memo"),
      "analysis",
    );
  });

  it("routes drafting cues to think", () => {
    assert.equal(
      classifyPearlHeuristic("Draft a blog post about our launch"),
      "think",
    );
    assert.equal(
      classifyPearlHeuristic("Rewrite this paragraph for tone"),
      "think",
    );
  });

  it("treats a long paste without a prose ask as analysis", () => {
    const paste = `${"word ".repeat(400)}please review this document`;
    assert.equal(classifyPearlHeuristic(paste), "analysis");
  });

  it("leaves weak or mixed cues undecided so Sol stays warm", () => {
    // Longer than the short-chat voice cutoff, with no tool / analysis / prose cue.
    const ambiguous =
      "I have been wondering about the relationship between cities and memory " +
      "for a while now, and I want to explore that carefully with some nuance " +
      "across a few different angles before settling anywhere. There is history, " +
      "architecture, and personal association mixed together in ways that feel " +
      "worth sitting with rather than rushing toward a conclusion today.";
    assert.ok(ambiguous.length >= 280);
    assert.equal(classifyPearlHeuristic(ambiguous), null);
  });
});

describe("waitingLabelForText", () => {
  it("names calendar and mail waits specifically", () => {
    assert.equal(
      waitingLabelForText("What's on my calendar?"),
      "Checking your calendar",
    );
    assert.equal(
      waitingLabelForText("Check my email"),
      "Checking your mail",
    );
  });

  it("falls back to Thinking for chat", () => {
    assert.equal(waitingLabelForText("hi"), "Thinking");
  });
});

describe("modelForLane", () => {
  it("pins Sol Fast at low reasoning for voice and think", () => {
    const voice = modelForLane("voice");
    assert.equal(voice.model, PEARL_LANES.voice.primary);
    assert.equal(voice.reasoning, "low");
    assert.equal(modelForLane("think").model, PEARL_LANES.think.primary);
  });

  it("routes tools to Inkling and analysis to Ultramarine", () => {
    assert.equal(modelForLane("tools").model, PEARL_LANES.tools.primary);
    assert.equal(
      modelForLane("analysis").model,
      PEARL_LANES.analysis.primary,
    );
  });

  it("keeps the specialist confidence bar at 0.7", () => {
    assert.equal(PEARL_SPECIALIST_THRESHOLD, 0.7);
  });

  it("drops the US region pin on the Ultramarine analysis lane", () => {
    const analysisGateway = modelForLane("analysis").modelOptions
      .providerOptions.gateway as {
      inferenceRegion?: unknown;
      zeroDataRetention?: boolean;
    };
    assert.equal(analysisGateway.inferenceRegion, undefined);
    assert.equal(analysisGateway.zeroDataRetention, true);
    const voiceGateway = modelForLane("voice").modelOptions.providerOptions
      .gateway as { inferenceRegion?: { geoRegion?: string } };
    assert.equal(voiceGateway.inferenceRegion?.geoRegion, "us");
  });
});

describe("laneFromDecisionAnswer", () => {
  it("accepts tools or analysis only at or above the confidence bar", () => {
    assert.equal(
      laneFromDecisionAnswer({
        choice: "tools",
        probabilities: { tools: 0.7 },
      }),
      "tools",
    );
    assert.equal(
      laneFromDecisionAnswer({
        choice: "analysis",
        probabilities: { analysis: 0.91 },
      }),
      "analysis",
    );
  });

  it("falls back to voice on a weak specialist or non-specialist choice", () => {
    assert.equal(
      laneFromDecisionAnswer({
        choice: "tools",
        probabilities: { tools: 0.69 },
      }),
      "voice",
    );
    assert.equal(
      laneFromDecisionAnswer({
        choice: "think",
        probabilities: { think: 0.99 },
      }),
      "voice",
    );
    assert.equal(laneFromDecisionAnswer({ choice: "voice" }), "voice");
  });
});

describe("resolvePinnedModelForStep", () => {
  const originalOverride = process.env.AGENT_MODEL_OVERRIDE;

  function clearOverride() {
    delete process.env.AGENT_MODEL_OVERRIDE;
  }

  function gatewayOf(
    selection: ReturnType<typeof resolvePinnedModelForStep>,
  ) {
    return selection.modelOptions.providerOptions.gateway as unknown as {
      zeroDataRetention?: boolean;
      disallowPromptTraining?: boolean;
      inferenceRegion?: { geoRegion?: string };
    };
  }

  it("applies the full policy to every client pin", () => {
    clearOverride();
    for (const [key, model] of Object.entries(CLIENT_MODEL_KEYS)) {
      const selection = resolvePinnedModelForStep([markerMessage(key)]);
      assert.equal(selection.model, model);
      assert.equal(gatewayOf(selection).zeroDataRetention, true);
      assert.equal(gatewayOf(selection).disallowPromptTraining, true);
      assert.equal(gatewayOf(selection).inferenceRegion?.geoRegion, "us");
    }
  });

  it("lets AGENT_MODEL_OVERRIDE win over the client picker", () => {
    process.env.AGENT_MODEL_OVERRIDE = "openai/gpt-6-luna";
    try {
      const selection = resolvePinnedModelForStep([
        markerMessage("muse-spark-open"),
      ]);
      assert.equal(selection.model, "openai/gpt-6-luna");
    } finally {
      if (originalOverride === undefined) clearOverride();
      else process.env.AGENT_MODEL_OVERRIDE = originalOverride;
    }
  });

  it("treats the auto marker like a missing marker (Auto route)", () => {
    clearOverride();
    assert.equal(
      readClientModelSelection([markerMessage(AUTO_MODEL_KEY)]),
      undefined,
    );
  });
});

describe("coder Apex default", () => {
  it("uses callstack/apex as the fast primary without ZDR filters", () => {
    assert.equal(CODER_TIERS.fast.primary, "callstack/apex");
    assert.equal(CODER_TIERS.fast.omitGatewayPolicy, true);
    assert.equal(CODER_TIERS.frontier.omitGatewayPolicy, false);
  });
});

describe("nextRevealLength", () => {
  it("advances to the full received text with no character cap", () => {
    const text = "Hello from a fast model reply that would have been drip-fed.";
    const step = nextRevealLength(text, 0, 16);
    assert.equal(step.end, text.length);
    assert.equal(nextRevealLength(text, 5, 16).end, text.length);
  });
});
