import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";

import { addCustomAgentMemory } from "@/lib/custom-agents/config";
import { resolveActiveCustomAgent } from "@/lib/custom-agents/resolve-active";

import { requirePrincipalUser } from "../lib/principal.ts";

const tool = defineTool({
  description:
    "Save a durable fact for the active custom agent (Memories). Use when the " +
    "user asks this role to remember something. Does not write to global Pearl memory.",
  inputSchema: z.object({
    text: z.string().min(1).max(2000),
  }),
  async execute(input, ctx) {
    const auth = await requirePrincipalUser(ctx.session.auth.current);
    if ("error" in auth) {
      return { status: "error", error: auth.error };
    }
    const agent = await resolveActiveCustomAgent({
      userId: auth.userId,
      messages: ctx.messages as readonly {
        readonly role: string;
        readonly content: unknown;
        readonly kind?: unknown;
      }[],
      sessionId: ctx.session.id,
    });
    if (!agent) {
      return {
        status: "error",
        error: "No custom agent is active in this thread.",
      };
    }
    const row = await addCustomAgentMemory(auth.userId, agent.id, input.text);
    return { status: "ok", id: row.id, text: row.text };
  },
});

export default defineDynamic(() => tool);
