import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_MODEL,
  CLIENT_MODEL_KEYS,
  CLIENT_IMAGE_MODEL_KEYS,
  CLIENT_VECTOR_MODEL_KEYS,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VECTOR_MODEL,
  IMAGE_MODEL_SELECTION_MARKER,
  MODEL_SELECTION_MARKER,
  VECTOR_MODEL_SELECTION_MARKER,
  readClientImageModelSelection,
  readClientModelSelection,
  readClientVectorModelSelection,
  resolveImageModelForTurn,
  resolveVectorModelForTurn,
} from "../agent/model-selection.ts";
import { resolvePinnedModelForStep } from "../agent/model-router.ts";
import {
  AUTO_MODEL_KEY,
} from "../agent/model-selection.ts";
import {
  COMPOSER_MODELS as WEB_MODELS,
  COMPOSER_MODEL_SECTIONS as WEB_SECTIONS,
  DEFAULT_IMAGE_MODEL_KEY as WEB_DEFAULT_IMAGE_KEY,
  DEFAULT_MODEL_KEY as WEB_DEFAULT_KEY,
  DEFAULT_VECTOR_MODEL_KEY as WEB_DEFAULT_VECTOR_KEY,
  IMAGE_MODELS as WEB_IMAGE_MODELS,
  VECTOR_MODELS as WEB_VECTOR_MODELS,
} from "../app/_components/model-selection.ts";
import {
  COMPOSER_MODELS as MOBILE_MODELS,
  COMPOSER_MODEL_SECTIONS as MOBILE_SECTIONS,
  DEFAULT_IMAGE_MODEL_KEY as MOBILE_DEFAULT_IMAGE_KEY,
  DEFAULT_MODEL_KEY as MOBILE_DEFAULT_KEY,
  DEFAULT_VECTOR_MODEL_KEY as MOBILE_DEFAULT_VECTOR_KEY,
  IMAGE_MODELS as MOBILE_IMAGE_MODELS,
  VECTOR_MODELS as MOBILE_VECTOR_MODELS,
} from "../mobile/src/model-selection.ts";

// eve wraps a JSON-object clientContext as an ephemeral framework user message
// of kind "context.instruction", rendered as `Client context:\n{...}`.
function markerMessage(key: string) {
  return {
    role: "user",
    kind: "context.instruction",
    content: `Client context:\n${JSON.stringify({ [MODEL_SELECTION_MARKER]: key })}`,
  };
}

describe("readClientModelSelection", () => {
  it("returns undefined when no marker is present", () => {
    expectUndefined([{ role: "user", content: "Hello there" }]);
    expectUndefined([]);
  });

  it("maps every allowlisted key to its gateway model id", () => {
    for (const [key, model] of Object.entries(CLIENT_MODEL_KEYS)) {
      assert.equal(readClientModelSelection([markerMessage(key)]), model);
    }
  });

  it("rejects keys outside the allowlist", () => {
    expectUndefined([markerMessage("gpt-6-sol")]);
    expectUndefined([markerMessage("openai/gpt-6.1-sol")]);
    expectUndefined([markerMessage("meta/muse-spark-open")]);
    expectUndefined([markerMessage("spacexai/grok-4.7")]);
    expectUndefined([markerMessage("x-proto/hyperion")]);
    expectUndefined([markerMessage("")]);
  });

  it("prefers the newest marker message", () => {
    assert.equal(
      readClientModelSelection([
        markerMessage("glm-5.3-flash"),
        markerMessage("muse-spark-open"),
      ]),
      CLIENT_MODEL_KEYS["muse-spark-open"],
    );
  });

  it("ignores non-user roles", () => {
    expectUndefined([
      {
        role: "assistant",
        kind: "context.instruction",
        content: '{"eveModelSelection":"gpt-6.1-sol"}',
      },
    ]);
  });

  it("ignores regular user messages quoting the marker", () => {
    expectUndefined([
      {
        role: "user",
        kind: "user",
        content: 'I said {"eveModelSelection":"gpt-6.1-sol"} out loud',
      },
      { role: "user", content: '{"eveModelSelection":"gpt-6.1-sol"}' },
    ]);
  });

  it("ignores context messages without a parseable marker value", () => {
    expectUndefined([
      {
        role: "user",
        kind: "context.instruction",
        content: "Client context:\nnot json at all",
      },
      {
        role: "user",
        kind: "context.instruction",
        content: '{"eveModelSelection":123}',
      },
    ]);
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

  it("keeps DEFAULT_MODEL as Sol for subagents and the allowlist baseline", () => {
    clearOverride();
    assert.equal(DEFAULT_MODEL, "openai/gpt-6.1-sol");
    const selection = resolvePinnedModelForStep([]);
    assert.equal(selection.model, DEFAULT_MODEL);
    assert.equal(gatewayOf(selection).zeroDataRetention, true);
    assert.equal(gatewayOf(selection).disallowPromptTraining, true);
    assert.equal(gatewayOf(selection).inferenceRegion?.geoRegion, "us");
  });

  it("applies the full policy to every client choice", () => {
    clearOverride();
    for (const [key, model] of Object.entries(CLIENT_MODEL_KEYS)) {
      const selection = resolvePinnedModelForStep([markerMessage(key)]);
      assert.equal(selection.model, model);
      assert.equal(gatewayOf(selection).zeroDataRetention, true);
      assert.equal(gatewayOf(selection).disallowPromptTraining, true);
      assert.equal(gatewayOf(selection).inferenceRegion?.geoRegion, "us");
    }
  });

  it("falls back to GPT 6.1 Sol when an old picker key is sent", () => {
    clearOverride();
    const selection = resolvePinnedModelForStep([markerMessage("gpt-6-sol")]);
    assert.equal(selection.model, DEFAULT_MODEL);
    assert.equal(gatewayOf(selection).zeroDataRetention, true);
  });

  it("lets AGENT_MODEL_OVERRIDE win over the client picker", () => {
    process.env.AGENT_MODEL_OVERRIDE = "openai/gpt-6-luna";
    try {
      const selection = resolvePinnedModelForStep([
        markerMessage("muse-spark-open"),
      ]);
      assert.equal(selection.model, "openai/gpt-6-luna");
      assert.equal(gatewayOf(selection).zeroDataRetention, true);
    } finally {
      if (originalOverride === undefined) {
        clearOverride();
      } else {
        process.env.AGENT_MODEL_OVERRIDE = originalOverride;
      }
    }
  });
});

describe("composer model lists", () => {
  it("uses the same default and allowlisted options on web and mobile", () => {
    assert.equal(WEB_DEFAULT_KEY, AUTO_MODEL_KEY);
    assert.equal(MOBILE_DEFAULT_KEY, WEB_DEFAULT_KEY);
    assert.deepEqual(MOBILE_MODELS, WEB_MODELS);
    assert.deepEqual(MOBILE_SECTIONS, WEB_SECTIONS);
    const pinKeys = WEB_MODELS.map((model) => model.key).filter(
      (key) => key !== AUTO_MODEL_KEY,
    );
    assert.deepEqual(pinKeys.sort(), Object.keys(CLIENT_MODEL_KEYS).sort());
  });

  it("groups auto, daily drivers, and frontier models", () => {
    assert.deepEqual(
      WEB_SECTIONS.map((section) => section.id),
      ["auto", "daily-driver", "frontier"],
    );
    assert.equal(
      WEB_SECTIONS.find((section) => section.id === "frontier")?.description,
      "Frontier coding, long-running agents, and advanced computer use.",
    );
    assert.deepEqual(
      WEB_SECTIONS.find((section) => section.id === "frontier")?.models.map(
        (model) => model.key,
      ),
      ["gpt-6-astra", "gemini-4-argon", "muse-wonder-1.0"],
    );
  });

  it("keeps image models on a separate allowlist from chat models", () => {
    assert.equal(WEB_DEFAULT_IMAGE_KEY, "gpt-image-1");
    assert.equal(MOBILE_DEFAULT_IMAGE_KEY, WEB_DEFAULT_IMAGE_KEY);
    assert.deepEqual(MOBILE_IMAGE_MODELS, WEB_IMAGE_MODELS);
    assert.deepEqual(
      WEB_IMAGE_MODELS.map((model) => model.key).sort(),
      Object.keys(CLIENT_IMAGE_MODEL_KEYS).sort(),
    );
    for (const key of Object.keys(CLIENT_IMAGE_MODEL_KEYS)) {
      assert.equal(key in CLIENT_MODEL_KEYS, false);
    }
  });

  it("keeps vector models on a separate allowlist from chat and image models", () => {
    assert.equal(WEB_DEFAULT_VECTOR_KEY, "arrow-2");
    assert.equal(MOBILE_DEFAULT_VECTOR_KEY, WEB_DEFAULT_VECTOR_KEY);
    assert.deepEqual(MOBILE_VECTOR_MODELS, WEB_VECTOR_MODELS);
    assert.deepEqual(
      WEB_VECTOR_MODELS.map((model) => model.key).sort(),
      Object.keys(CLIENT_VECTOR_MODEL_KEYS).sort(),
    );
    for (const key of Object.keys(CLIENT_VECTOR_MODEL_KEYS)) {
      assert.equal(key in CLIENT_MODEL_KEYS, false);
      assert.equal(key in CLIENT_IMAGE_MODEL_KEYS, false);
    }
  });
});

describe("readClientImageModelSelection", () => {
  function imageMarkerMessage(key: string) {
    return {
      role: "user",
      kind: "context.instruction",
      content: `Client context:\n${JSON.stringify({ [IMAGE_MODEL_SELECTION_MARKER]: key })}`,
    };
  }

  it("maps allowlisted image keys and falls back to the default", () => {
    for (const [key, model] of Object.entries(CLIENT_IMAGE_MODEL_KEYS)) {
      assert.equal(readClientImageModelSelection([imageMarkerMessage(key)]), model);
    }
    assert.equal(readClientImageModelSelection([]), undefined);
    assert.equal(resolveImageModelForTurn([]), DEFAULT_IMAGE_MODEL);
    assert.equal(
      resolveImageModelForTurn([imageMarkerMessage("not-a-model")]),
      DEFAULT_IMAGE_MODEL,
    );
  });

  it("ignores chat-model keys sent as image selection", () => {
    assert.equal(
      readClientImageModelSelection([imageMarkerMessage("gpt-6.1-sol")]),
      undefined,
    );
  });
});

describe("readClientVectorModelSelection", () => {
  function vectorMarkerMessage(key: string) {
    return {
      role: "user",
      kind: "context.instruction",
      content: `Client context:\n${JSON.stringify({ [VECTOR_MODEL_SELECTION_MARKER]: key })}`,
    };
  }

  it("maps allowlisted vector keys and falls back to the default", () => {
    for (const [key, model] of Object.entries(CLIENT_VECTOR_MODEL_KEYS)) {
      assert.equal(
        readClientVectorModelSelection([vectorMarkerMessage(key)]),
        model,
      );
    }
    assert.equal(readClientVectorModelSelection([]), undefined);
    assert.equal(resolveVectorModelForTurn([]), DEFAULT_VECTOR_MODEL);
    assert.equal(
      resolveVectorModelForTurn([vectorMarkerMessage("not-a-model")]),
      DEFAULT_VECTOR_MODEL,
    );
  });

  it("ignores chat and image keys sent as vector selection", () => {
    assert.equal(
      readClientVectorModelSelection([vectorMarkerMessage("gpt-6.1-sol")]),
      undefined,
    );
    assert.equal(
      readClientVectorModelSelection([vectorMarkerMessage("gpt-image-1")]),
      undefined,
    );
  });
});

function expectUndefined(
  messages: Parameters<typeof readClientModelSelection>[0],
) {
  assert.equal(readClientModelSelection(messages), undefined);
}
