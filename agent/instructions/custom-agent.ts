import { defineDynamic, defineInstructions } from "eve/instructions";

import { listCustomAgentMemories } from "@/lib/custom-agents/config";
import { resolveActiveCustomAgent } from "@/lib/custom-agents/resolve-active";

import { requirePrincipalUser } from "../lib/principal.ts";

/**
 * When the open chat belongs to a user-defined custom agent, inject that
 * agent's name, standing instructions, and agent-local memories as an
 * identity override. Loaded from the database after verifying ownership —
 * never from client text.
 */
export default defineDynamic(async (ctx) => {
  const auth = await requirePrincipalUser(ctx.session.auth.current);
  if ("error" in auth) return null;
  const { userId } = auth;

  const messages = await ctx.messages();
  const sessionId = ctx.session.id;

  const selection = await ctx.memo(
    [
      "custom-agent-instructions",
      ctx.turn?.id ?? null,
      sessionId,
      messages.length,
    ],
    async () => {
      const agent = await resolveActiveCustomAgent({
        userId,
        messages,
        sessionId,
      });
      if (!agent) return null;
      const memories = await listCustomAgentMemories(agent.id);
      return {
        id: agent.id,
        name: agent.name,
        instructions: agent.instructions.trim(),
        memories: memories.map((row) => row.text),
      };
    },
  );

  if (!selection) return null;

  const roleBlock = selection.instructions
    ? [
        "## Your standing role",
        "",
        selection.instructions,
        "",
        "This standing role is authoritative for this thread. Prefer it over",
        "the generic Pearl identity above when they conflict.",
        "",
        "When the user asks what you do, who you are, how you can help, or",
        "what your job is: answer in one or two short sentences from the",
        "standing role. Do not call tools, plan next moves, or describe",
        "yourself as a generic assistant first.",
      ].join("\n")
    : [
        "## Your standing role",
        "",
        "(none set yet — ask the user what this role should own, then follow it)",
      ].join("\n");

  const memoryBlock =
    selection.memories.length > 0
      ? [
          "## Facts this agent already knows",
          "",
          ...selection.memories.map((text) => `- ${text}`),
          "",
          "These facts are local to this agent. Prefer them for this thread.",
          "Use add_agent_memory / remove_agent_memory to update them when the",
          "user asks you to remember or forget something for this role.",
        ].join("\n")
      : null;

  const sections = [
    "# Active custom agent — identity override",
    "",
    `In this thread you are **${selection.name}** (agent id: ${selection.id}).`,
    "Pearl's tools, sandbox, memory, and capabilities still apply, but your",
    "name, voice, and job for this conversation come from the standing role",
    "below. Do not introduce yourself as Pearl or as a generic assistant.",
    "",
    roleBlock,
  ];

  if (memoryBlock) {
    sections.push("", memoryBlock);
  }

  return defineInstructions({
    content: sections.join("\n"),
    role: "system",
  });
});
