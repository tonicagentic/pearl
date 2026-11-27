import { defineDynamic, defineInstructions } from "eve/instructions";

import { planMirrorPath } from "@/agent/lib/plan-mirror";
import { listProjectGoals } from "@/lib/db/project-goals";
import { getProject } from "@/lib/db/projects";
import { listProjectLinks } from "@/lib/db/project-links";
import { listProjectFiles } from "@/lib/project-files";
import { listProjectPins } from "@/lib/db/workbench-pins";

import { requirePrincipalUser } from "../lib/principal.ts";
import { syncTurnClientIntent } from "../lib/turn-context.ts";

// When the turn is attached to a verified project, inject its name,
// properties, instructions, active goals, file index, URL links, and
// linked repos. Bodies stay out of the prompt — use read_project_file
// / list_goals when a specific document or full goal notes are needed.

export default defineDynamic(async (ctx) => {
  const intent = syncTurnClientIntent(await ctx.messages());
  if (!intent.projectId) return null;

  const auth = await requirePrincipalUser(ctx.session.auth.current);
  if ("error" in auth) return null;
  const { userId } = auth;
  const owned = await getProject(userId, intent.projectId);
  if (!owned) return null;

  const [files, pins, links, goals] = await Promise.all([
    listProjectFiles(userId, owned.id),
    listProjectPins(userId, owned.id),
    listProjectLinks(userId, owned.id),
    listProjectGoals(userId, owned.id),
  ]);

  const planFiles = files.filter((row) =>
    row.pathname.includes(`docs/plans/${owned.id}/`),
  );
  const listed = planFiles.length > 0 ? planFiles : files;

  const fileLines =
    listed.length === 0
      ? ["(no project files yet)"]
      : listed.map((row) => {
          const base = row.pathname.split("/").pop() ?? row.title;
          const slug = base.replace(/\.md$/i, "");
          const path = row.pathname.includes(`docs/plans/${owned.id}/`)
            ? planMirrorPath(owned.id, slug)
            : `(library) ${row.pathname}`;
          return `- ${row.title} (id: ${row.id}, path: ${path})`;
        });

  const linkLines =
    links.length === 0
      ? ["(no URL links yet)"]
      : links.map(
          (link) =>
            `- ${link.title} (id: ${link.id}, url: ${link.url})`,
        );

  const repoLines =
    pins.length === 0
      ? ["(no repos linked yet)"]
      : pins.map((pin) => {
          const vercel = pin.vercelProjectId
            ? `, vercelProjectId: ${pin.vercelProjectId}`
            : "";
          const expo = pin.expoProjectId
            ? `, expoProjectId: ${pin.expoProjectId}`
            : "";
          return `- ${pin.fullName} (pin id: ${pin.id}${vercel}${expo})`;
        });

  const activeGoals = goals.filter((goal) => goal.status === "active");
  const goalLines =
    activeGoals.length === 0
      ? ["(no active goals)"]
      : activeGoals.map((goal) => {
          const date = goal.targetDate ? `, target: ${goal.targetDate}` : "";
          return `- ${goal.title} (id: ${goal.id}${date})`;
        });

  const instructions = owned.instructions.trim();
  const sections = [
    "# Active project",
    "",
    `Name: ${owned.name}`,
    `Project id: ${owned.id}`,
    `Status: ${owned.status}`,
    `Priority: ${owned.priority}`,
    `Start date: ${owned.startDate ?? "(none)"}`,
    `Target date: ${owned.targetDate ?? "(none)"}`,
    "",
    instructions
      ? ["## Project instructions", "", instructions].join("\n")
      : "## Project instructions\n\n(none set)",
    "",
    "## Active goals",
    "",
    ...goalLines,
    "",
    "Call list_goals when you need notes or done goals. Do not invent goals",
    "that are not listed.",
    "",
    "## Files in this project",
    "",
    ...fileLines,
    "",
    "Call read_project_file (or read_file on the path) when you need a file",
    "body. Project files under /workspace/docs/plans/ are the source of",
    "truth. Do not invent files that are not listed.",
    "",
    "## URL links in this project",
    "",
    ...linkLines,
    "",
    "## Repos in this project",
    "",
    ...repoLines,
    "",
    "When building software for this project, prefer these linked repos for",
    "`coder` unless the user names a different repo. Do not invent repos",
    "that are not listed.",
  ];

  return defineInstructions({
    content: sections.join("\n"),
    role: "system",
  });
});
