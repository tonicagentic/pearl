import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";

import {
  deleteCustomAgentMemory,
  listCustomAgentMemories,
} from "@/lib/custom-agents/config";
import { resolveActiveCustomAgent } from "@/lib/custom-agents/resolve-active";

import { requirePrincipalUser } from "../lib/principal.ts";

const tool = defineTool({
  description:
    "Remove a fact from the active custom agent's Memories. Pass the memory id " +
    "from the standing facts list, or exact text to match.",
  inputSchema: z.object({
    id: z.string().nullish(),
    text: z.string().nullish(),
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

    let memoryId = input.id?.trim() || null;
    if (!memoryId && input.text?.trim()) {
      const rows = await listCustomAgentMemories(agent.id);
      const needle = input.text.trim().toLowerCase();
      const match = rows.find((row) => row.text.toLowerCase() === needle);
      memoryId = match?.id ?? null;
    }
    if (!memoryId) {
      return { status: "error", error: "Pass a memory id or exact text." };
    }

    const ok = await deleteCustomAgentMemory(
      auth.userId,
      agent.id,
      memoryId,
    );
    return ok
      ? { status: "ok", id: memoryId }
      : { status: "error", error: "Memory not found." };
  },
});

export default defineDynamic(() => tool);
