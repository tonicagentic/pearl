import { defineDynamic, defineInstructions } from "eve/instructions";
import { eq } from "drizzle-orm";

import { listCustomAgentMemories } from "@/lib/custom-agents/config";
import { resolveActiveCustomAgent } from "@/lib/custom-agents/resolve-active";
import { db } from "@/lib/db/client";
import { project } from "@/lib/db/schema";

import { requirePrincipalUser } from "../lib/principal.ts";

/**
 * When the open chat belongs to a user-defined custom agent, inject that
 * agent's name, standing instructions, agent-local memories, and the parent
 * project's brief. Loaded from the database after verifying ownership —
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
      const [memories, projectRow] = await Promise.all([
        listCustomAgentMemories(agent.id),
        db
          .select({
            name: project.name,
            instructions: project.instructions,
          })
          .from(project)
          .where(eq(project.id, agent.projectId))
          .limit(1)
          .then((rows) => rows[0] ?? null),
      ]);
      return {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        instructions: agent.instructions.trim(),
        memories: memories.map((row) => row.text),
        projectName: projectRow?.name ?? null,
        projectBrief: projectRow?.instructions?.trim() || null,
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

  const projectBlock = selection.projectName
    ? [
        "## Project",
        "",
        `You belong to the project **${selection.projectName}**` +
          (selection.role === "manager" ? " as its manager." : "."),
        selection.projectBrief
          ? [
              "",
              "### Project brief",
              "",
              selection.projectBrief,
              "",
              "Treat the project brief as shared context for every agent in",
              "this project. Prefer it when it conflicts with generic Pearl",
              "defaults; your standing role still wins for voice and job.",
            ].join("\n")
          : "",
      ]
        .filter(Boolean)
        .join("\n")
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

  if (projectBlock) {
    sections.push("", projectBlock);
  }

  if (memoryBlock) {
    sections.push("", memoryBlock);
  }

  return defineInstructions({
    content: sections.join("\n"),
    role: "system",
  });
});
