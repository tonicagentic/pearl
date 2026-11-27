import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canUseQuickPath,
  classifyPearlHeuristic,
  laneNeedsImageSurface,
  QUICK_PATH_MAX_TURNS,
  waitingLabelForText,
} from "../lib/pearl-lane.ts";
import {
  CODER_TIERS,
} from "../agent/subagents/coder/model-router.ts";
import {
  PEARL_AUTO_MODEL_IDS,
  PEARL_AUTO_OPTION_DESCRIPTIONS,
  PEARL_QUICK_MODEL,
  PEARL_ROUTINE_GATEWAY_OPTIONS,
  PEARL_ROUTINE_MODEL,
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

  it("routes goals and issues cues to tools", () => {
    assert.equal(
      classifyPearlHeuristic("I want to set a new goal."),
      "tools",
    );
    assert.equal(
      classifyPearlHeuristic("What am I working toward right now?"),
      "tools",
    );
    assert.equal(
      classifyPearlHeuristic("What are my open issues?"),
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

  it("routes lead-gen and prospecting cues to analysis (exa surface)", () => {
    assert.equal(
      classifyPearlHeuristic(
        "Build a lead list of 5 AI infrastructure startups in San Francisco.",
      ),
      "analysis",
    );
    assert.equal(
      classifyPearlHeuristic(
        "I want to start sales prospecting. Build me a targeted list.",
      ),
      "analysis",
    );
  });

  it("keeps analysis when prospecting also asks to write a file or avoid email lists", () => {
    // "Write the offer…" is a prose cue; must not steal the Exa surface.
    assert.equal(
      classifyPearlHeuristic(
        "Here is the filled offer and the ICP I chose:\n\n" +
          "Offer\nKind: general offer\nName: maintenance monitoring\n" +
          "ICP\nIndustry: industrial refrigeration\n" +
          "Build a targeted company list. Fit matters more than volume. " +
          "Write the offer to a workspace file. Use effort low.",
      ),
      "analysis",
    );
    // "companies to email" must not route to the tools lane.
    assert.equal(
      classifyPearlHeuristic(
        "Here is the offer:\n\nOffer\nName: maintenance monitoring\n" +
          "Pain: unplanned compressor downtime\n\n" +
          "Find other ideal customers who share that pain. I want customer kinds " +
          "(industry and buyer role), not a list of companies to email. Use effort low.",
      ),
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

  it("leaves weak or mixed cues undecided so tool surfaces stay open", () => {
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

describe("canUseQuickPath", () => {
  const base = {
    text: "hey, what do you think?",
    hasEveSession: false,
    hasAttachments: false,
    hasCustomAgent: false,
    hasRemoteAgent: false,
    hasProject: false,
    hasPinnedModel: false,
    quickTurnCount: 0,
  };

  it("allows short voice chat with a clean thread", () => {
    assert.equal(canUseQuickPath(base), true);
  });

  it("rejects once an eve session exists", () => {
    assert.equal(canUseQuickPath({ ...base, hasEveSession: true }), false);
  });

  it("rejects attachments, agents, project, and pinned models", () => {
    assert.equal(canUseQuickPath({ ...base, hasAttachments: true }), false);
    assert.equal(canUseQuickPath({ ...base, hasCustomAgent: true }), false);
    assert.equal(canUseQuickPath({ ...base, hasRemoteAgent: true }), false);
    assert.equal(canUseQuickPath({ ...base, hasProject: true }), false);
    assert.equal(canUseQuickPath({ ...base, hasPinnedModel: true }), false);
  });

  it("rejects tool, analysis, and think cues", () => {
    assert.equal(
      canUseQuickPath({ ...base, text: "What's on my calendar tomorrow?" }),
      false,
    );
    assert.equal(
      canUseQuickPath({ ...base, text: "Summarize this contract for diligence" }),
      false,
    );
    assert.equal(
      canUseQuickPath({ ...base, text: "Draft a blog post about our launch" }),
      false,
    );
  });

  it("rejects ambiguous long chat so eve handles it", () => {
    const ambiguous =
      "I have been wondering about the relationship between cities and memory " +
      "for a while now, and I want to explore that carefully with some nuance " +
      "across a few different angles before settling anywhere. There is history, " +
      "architecture, and personal association mixed together in ways that feel " +
      "worth sitting with rather than rushing toward a conclusion today.";
    assert.equal(canUseQuickPath({ ...base, text: ambiguous }), false);
  });

  it("rejects once the quick transcript hits the turn cap", () => {
    assert.equal(
      canUseQuickPath({ ...base, quickTurnCount: QUICK_PATH_MAX_TURNS }),
      false,
    );
    assert.equal(
      canUseQuickPath({ ...base, quickTurnCount: QUICK_PATH_MAX_TURNS - 1 }),
      true,
    );
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
    assert.equal(waitingLabelForText("hi"), "Planning next moves");
  });
});

describe("laneNeedsImageSurface", () => {
  it("exposes image tools for photo and picture asks on voice", () => {
    assert.equal(
      laneNeedsImageSurface("voice", "Can you make a photo of a cat?"),
      true,
    );
    assert.equal(
      laneNeedsImageSurface("voice", "Draw a picture of the Golden Gate"),
      true,
    );
  });

  it("keeps image tools off ordinary chat on a routed lane", () => {
    assert.equal(laneNeedsImageSurface("voice", "hey, what do you think?"), false);
    assert.equal(laneNeedsImageSurface("think", "Draft a blog post"), false);
  });

  it("exposes every surface when no Auto lane is set", () => {
    assert.equal(laneNeedsImageSurface(null, "hey"), true);
  });
});

describe("pearl auto options", () => {
  it("defaults routine and quick path to inkling-2-mini", () => {
    assert.equal(PEARL_ROUTINE_MODEL, "thinkingmachines/inkling-2-mini");
    assert.equal(PEARL_QUICK_MODEL, PEARL_ROUTINE_MODEL);
  });

  it("drops the US region pin on mini (ZDR only)", () => {
    assert.equal(
      (PEARL_ROUTINE_GATEWAY_OPTIONS as { inferenceRegion?: unknown })
        .inferenceRegion,
      undefined,
    );
    assert.equal(PEARL_ROUTINE_GATEWAY_OPTIONS.zeroDataRetention, true);
    assert.equal(PEARL_ROUTINE_GATEWAY_OPTIONS.disallowPromptTraining, true);
  });

  it("covers mini, Sol, and Ultramarine with prod-grounded descriptions", () => {
    assert.deepEqual([...PEARL_AUTO_MODEL_IDS].sort(), [
      "openai/gpt-6.1-sol",
      "paperinstruments/ultramarine-1-flash",
      "thinkingmachines/inkling-2-mini",
    ]);
    assert.match(
      PEARL_AUTO_OPTION_DESCRIPTIONS[PEARL_ROUTINE_MODEL],
      /feelings|sitting-with|short factual/i,
    );
    assert.match(
      PEARL_AUTO_OPTION_DESCRIPTIONS["openai/gpt-6.1-sol"],
      /judgment|nuance|drafting/i,
    );
    assert.match(
      PEARL_AUTO_OPTION_DESCRIPTIONS["paperinstruments/ultramarine-1-flash"],
      /documents|diligence|research/i,
    );
  });

  it("allowlists inkling-2-mini on the client picker", () => {
    assert.equal(
      CLIENT_MODEL_KEYS["inkling-2-mini"],
      "thinkingmachines/inkling-2-mini",
    );
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

  it("applies ZDR to every client pin; US zone except mini", () => {
    clearOverride();
    for (const [key, model] of Object.entries(CLIENT_MODEL_KEYS)) {
      const selection = resolvePinnedModelForStep([markerMessage(key)]);
      assert.equal(selection.model, model);
      assert.equal(gatewayOf(selection).zeroDataRetention, true);
      assert.equal(gatewayOf(selection).disallowPromptTraining, true);
      if (model === "thinkingmachines/inkling-2-mini") {
        assert.equal(gatewayOf(selection).inferenceRegion, undefined);
      } else {
        assert.equal(gatewayOf(selection).inferenceRegion?.geoRegion, "us");
      }
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
