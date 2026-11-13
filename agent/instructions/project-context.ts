import { defineDynamic, defineInstructions } from "eve/instructions";

import { planMirrorPath } from "@/agent/lib/plan-mirror";
import { getProject, listPlans } from "@/lib/db/projects";

import { requirePrincipalUser } from "../lib/principal.ts";
import { syncTurnClientIntent } from "../lib/turn-context.ts";

// When the turn is attached to a verified project, inject its name,
// instructions, and plan index. Bodies stay out of the prompt — use
// read_plan when a specific document is needed.

export default defineDynamic(async (ctx) => {
  const intent = syncTurnClientIntent(await ctx.messages());
  if (!intent.projectId) return null;

  const auth = await requirePrincipalUser(ctx.session.auth.current);
  if ("error" in auth) return null;
  const { userId } = auth;
  const owned = await getProject(userId, intent.projectId);
  if (!owned) return null;

  const plans = await listPlans(userId, owned.id);
  const planLines =
    plans.length === 0
      ? ["(no plans yet)"]
      : plans.map((row) => {
          const path = planMirrorPath(row.projectId, row.slug);
          return `- ${row.title} (slug: ${row.slug}, id: ${row.id}, path: ${path})`;
        });

  const instructions = owned.instructions.trim();
  const sections = [
    "# Active project",
    "",
    `Name: ${owned.name}`,
    `Project id: ${owned.id}`,
    "",
    instructions
      ? ["## Project instructions", "", instructions].join("\n")
      : "## Project instructions\n\n(none set)",
    "",
    "## Plans in this project",
    "",
    ...planLines,
    "",
    "Call read_plan with a plan id or slug when you need a plan body (DB is",
    "source of truth). Mirror paths under /workspace/docs/plans/ are for",
    "sandbox/coder visibility; if they diverge, trust read_plan. Do not",
    "invent plans that are not listed.",
  ];

  return defineInstructions({
    content: sections.join("\n"),
    role: "system",
  });
});
