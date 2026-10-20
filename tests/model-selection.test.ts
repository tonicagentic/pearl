import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_MODEL,
  CLIENT_MODEL_KEYS,
  MODEL_SELECTION_MARKER,
  readClientModelSelection,
} from "../agent/model-selection.ts";
import { resolveModelForStep } from "../agent/agent.ts";
import {
  COMPOSER_MODELS as WEB_MODELS,
  DEFAULT_MODEL_KEY as WEB_DEFAULT_KEY,
} from "../app/_components/model-selection.ts";
import {
  COMPOSER_MODELS as MOBILE_MODELS,
  DEFAULT_MODEL_KEY as MOBILE_DEFAULT_KEY,
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

describe("resolveModelForStep", () => {
  const originalOverride = process.env.AGENT_MODEL_OVERRIDE;

  function clearOverride() {
    delete process.env.AGENT_MODEL_OVERRIDE;
  }

  function gatewayOf(selection: ReturnType<typeof resolveModelForStep>) {
    return selection.modelOptions.providerOptions.gateway as unknown as {
      zeroDataRetention?: boolean;
      disallowPromptTraining?: boolean;
      inferenceRegion?: { geoRegion?: string };
    };
  }

  it("resolves GPT 6.1 Sol by default with the full policy", () => {
    clearOverride();
    const selection = resolveModelForStep([]);
    assert.equal(DEFAULT_MODEL, "openai/gpt-6.1-sol");
    assert.equal(selection.model, DEFAULT_MODEL);
    assert.equal(gatewayOf(selection).zeroDataRetention, true);
    assert.equal(gatewayOf(selection).disallowPromptTraining, true);
    assert.equal(gatewayOf(selection).inferenceRegion?.geoRegion, "us");
  });

  it("applies the full policy to every client choice", () => {
    clearOverride();
    for (const [key, model] of Object.entries(CLIENT_MODEL_KEYS)) {
      const selection = resolveModelForStep([markerMessage(key)]);
      assert.equal(selection.model, model);
      assert.equal(gatewayOf(selection).zeroDataRetention, true);
      assert.equal(gatewayOf(selection).disallowPromptTraining, true);
      assert.equal(gatewayOf(selection).inferenceRegion?.geoRegion, "us");
    }
  });

  it("falls back to GPT 6.1 Sol when an old picker key is sent", () => {
    clearOverride();
    const selection = resolveModelForStep([markerMessage("gpt-6-sol")]);
    assert.equal(selection.model, DEFAULT_MODEL);
    assert.equal(gatewayOf(selection).zeroDataRetention, true);
  });

  it("lets AGENT_MODEL_OVERRIDE win over the client picker", () => {
    process.env.AGENT_MODEL_OVERRIDE = "openai/gpt-6-luna";
    try {
      const selection = resolveModelForStep([markerMessage("muse-spark-open")]);
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
    assert.equal(WEB_DEFAULT_KEY, "gpt-6.1-sol");
    assert.equal(MOBILE_DEFAULT_KEY, WEB_DEFAULT_KEY);
    assert.deepEqual(MOBILE_MODELS, WEB_MODELS);
    assert.deepEqual(
      WEB_MODELS.map((model) => model.key).sort(),
      Object.keys(CLIENT_MODEL_KEYS).sort(),
    );
  });
});

function expectUndefined(
  messages: Parameters<typeof readClientModelSelection>[0],
) {
  assert.equal(readClientModelSelection(messages), undefined);
}
