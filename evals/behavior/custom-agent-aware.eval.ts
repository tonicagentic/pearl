import { defineEval } from "eve/evals";

import {
  CHAT_ID_MARKER,
  CUSTOM_AGENT_ID_MARKER,
} from "../../lib/agent-mode-context.ts";
import { createCustomAgent } from "../../lib/custom-agents/store.ts";
import { ensureUserForPrincipal } from "../../lib/db/issues.ts";

const PRINCIPAL_ID = "local-dev";
const STANDING_ROLE =
  "You are Launch Coach. You help ship product launches. Be concise and action-oriented. Never claim to be a generic assistant.";

async function seedCustomAgent(): Promise<{
  readonly agentId: string;
  readonly chatId: string;
}> {
  await ensureUserForPrincipal({
    principalId: PRINCIPAL_ID,
    attributes: { name: "Local Dev", email: "local-dev@eve.local" },
  });

  const name = `Eval Launch Coach ${Date.now().toString(36)}`;
  const agent = await createCustomAgent(PRINCIPAL_ID, {
    name,
    instructions: STANDING_ROLE,
    accent: "#2DD4BF",
  });
  return { agentId: agent.id, chatId: agent.chatId };
}

export default defineEval({
  description:
    "Custom agent: with eveCustomAgentId clientContext, answers 'What do you do?' from standing instructions, not as generic Pearl.",
  tags: ["reliability", "smoke"],
  timeoutMs: 180_000,
  async test(t) {
    const { agentId, chatId } = await seedCustomAgent();

    const turn = await t.send("What do you do?", {
      clientContext: {
        [CUSTOM_AGENT_ID_MARKER]: agentId,
        [CHAT_ID_MARKER]: chatId,
      },
    });

    t.succeeded();
    t.usedNoTools();

    const reply = turn.reply ?? "";
    const lower = reply.toLowerCase();
    if (!/launch/i.test(reply)) {
      throw new Error(
        `Expected reply to mention launch role; got: ${reply.slice(0, 400)}`,
      );
    }
    if (
      /\bgeneric assistant\b/i.test(reply) ||
      (/i('m| am) (a |an )?(concise )?assistant built with eve/i.test(reply) &&
        !/launch/i.test(reply))
    ) {
      throw new Error(
        `Reply looked like generic Pearl identity; got: ${reply.slice(0, 400)}`,
      );
    }
    if (lower.includes("i don't know") && !lower.includes("launch")) {
      throw new Error(`Reply did not use standing role: ${reply.slice(0, 400)}`);
    }

    t.judge(
      "Does the assistant answer as a launch/product-shipping role (Launch Coach), not as a generic Pearl/eve assistant? Pass if it describes helping with product launches.",
      { on: reply },
    ).atLeast(0.8);
  },
});
