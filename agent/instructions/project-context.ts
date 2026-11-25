import { defineDynamic, defineInstructions } from "eve/instructions";

import { planMirrorPath } from "@/agent/lib/plan-mirror";
import { getProject } from "@/lib/db/projects";
import { listProjectFiles } from "@/lib/project-files";
import { listProjectPins } from "@/lib/db/workbench-pins";

import { requirePrincipalUser } from "../lib/principal.ts";
import { syncTurnClientIntent } from "../lib/turn-context.ts";

// When the turn is attached to a verified project, inject its name,
// instructions, file index, and linked repos. Bodies stay out of the
// prompt — use read_project_file when a specific document is needed.

export default defineDynamic(async (ctx) => {
  const intent = syncTurnClientIntent(await ctx.messages());
  if (!intent.projectId) return null;

  const auth = await requirePrincipalUser(ctx.session.auth.current);
  if ("error" in auth) return null;
  const { userId } = auth;
  const owned = await getProject(userId, intent.projectId);
  if (!owned) return null;

  const [files, pins] = await Promise.all([
    listProjectFiles(userId, owned.id),
    listProjectPins(userId, owned.id),
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
    "## Files in this project",
    "",
    ...fileLines,
    "",
    "Call read_project_file (or read_file on the path) when you need a file",
    "body. Project files under /workspace/docs/plans/ are the source of",
    "truth. Do not invent files that are not listed.",
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
