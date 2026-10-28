import { createFxAgent } from "libfx";
import { sandbox } from "durable-harness";
import { fxTools } from "durable-harness/fx";

/**
 * Module-scope fx agent for Pearl mini apps.
 * withDurableHarness discovers this export and mounts its wake handler.
 *
 * Harness + model credentials stay in the Function (AI Gateway via OIDC /
 * AI_GATEWAY_API_KEY); file/shell tools run in a Vercel Sandbox (Drive at
 * /workspace). Sandbox names are derived from the fx session id by
 * durable-harness (`dh-…`).
 */
export const pearlBuilderFx = createFxAgent({
  name: "pearl-builder",
  model: process.env.AGENT_MODEL_OVERRIDE?.trim() || "openai/gpt-6.1-sol",
  tools: [
    ...fxTools(
      sandbox({
        budget: { vmSeconds: 45 * 60 },
        network: {
          allow: [
            "registry.npmjs.org",
            "*.npmjs.org",
            "nodejs.org",
            "*.githubusercontent.com",
            "github.com",
            "api.github.com",
          ],
        },
        vcpus: 2,
      }),
    ),
  ],
});
