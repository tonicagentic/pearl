import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_MODEL,
  CLIENT_MODEL_KEYS,
  MODEL_SELECTION_MARKER,
  readClientModelSelection,
} from "../agent/model-selection.ts";
import { resolveModelForStep } from "../agent/agent.ts";

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

  it("maps allowlisted keys to gateway model ids", () => {
    assert.equal(
      readClientModelSelection([markerMessage("gpt-6-sol")]),
      CLIENT_MODEL_KEYS["gpt-6-sol"],
    );
    assert.equal(
      readClientModelSelection([markerMessage("glm-5.3-flash")]),
      CLIENT_MODEL_KEYS["glm-5.3-flash"],
    );
  });

  it("rejects keys outside the allowlist", () => {
    expectUndefined([markerMessage("openai/gpt-6-sol")]);
    expectUndefined([markerMessage("x-proto/hyperion")]);
    expectUndefined([markerMessage("")]);
  });

  it("prefers the newest marker message", () => {
    assert.equal(
      readClientModelSelection([
        markerMessage("glm-5.3-flash"),
        markerMessage("gpt-6-sol"),
      ]),
      CLIENT_MODEL_KEYS["gpt-6-sol"],
    );
  });

  it("ignores non-user roles", () => {
    expectUndefined([
      {
        role: "assistant",
        kind: "context.instruction",
        content: '{"eveModelSelection":"gpt-6-sol"}',
      },
    ]);
  });

  it("ignores regular user messages quoting the marker", () => {
    expectUndefined([
      {
        role: "user",
        kind: "user",
        content: 'I said {"eveModelSelection":"gpt-6-sol"} out loud',
      },
      { role: "user", content: '{"eveModelSelection":"gpt-6-sol"}' },
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

  it("resolves the default model with the full policy when no marker is present", () => {
    clearOverride();
    const selection = resolveModelForStep([]);
    assert.equal(selection.model, DEFAULT_MODEL);
    assert.equal(gatewayOf(selection).zeroDataRetention, true);
  });

  it("resolves the client-picked model with US region and no-training but no ZDR", () => {
    clearOverride();
    const selection = resolveModelForStep([markerMessage("gpt-6-sol")]);
    assert.equal(selection.model, CLIENT_MODEL_KEYS["gpt-6-sol"]);
    const gateway = gatewayOf(selection);
    assert.equal(gateway.zeroDataRetention, undefined);
    assert.equal(gateway.disallowPromptTraining, true);
    assert.equal(gateway.inferenceRegion?.geoRegion, "us");
  });

  it("lets AGENT_MODEL_OVERRIDE win over the client picker", () => {
    process.env.AGENT_MODEL_OVERRIDE = "openai/gpt-6-luna";
    try {
      const selection = resolveModelForStep([markerMessage("gpt-6-sol")]);
      assert.equal(selection.model, "openai/gpt-6-luna");
    } finally {
      if (originalOverride === undefined) {
        clearOverride();
      } else {
        process.env.AGENT_MODEL_OVERRIDE = originalOverride;
      }
    }
  });
});

function expectUndefined(
  messages: Parameters<typeof readClientModelSelection>[0],
) {
  assert.equal(readClientModelSelection(messages), undefined);
}
