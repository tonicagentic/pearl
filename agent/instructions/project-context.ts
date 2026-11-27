import { defineDynamic, defineInstructions } from "eve/instructions";

import { planMirrorPath } from "@/agent/lib/plan-mirror";
import { listProjectGoals } from "@/lib/db/project-goals";
import { getProject } from "@/lib/db/projects";
import { listProjectLinks } from "@/lib/db/project-links";
import type { Project } from "@/lib/db/schema";
import { listProjectPins } from "@/lib/db/workbench-pins";
import { listProjectFiles } from "@/lib/project-files";
import {
  extractProjectMentions,
  resolveTurnProjectId,
} from "@/lib/chat/project-mentions";

import { latestUserText } from "../model-router.ts";
import { requirePrincipalUser } from "../lib/principal.ts";
import {
  syncTurnClientIntent,
  turnClientIntent,
} from "../lib/turn-context.ts";

// When the turn is attached to a verified project — from clientContext or a
// single @-mention — inject its name, properties, instructions, active goals,
// file index, URL links, and linked repos. Extra @-mentioned projects get a
// "Referenced projects" brief; tools must pass projectId to use those.
// Bodies stay out of the prompt — use read_project_file / list_goals when a
// specific document or full goal notes are needed.

type ProjectBriefBundle = {
  readonly owned: Project;
  readonly fileLines: readonly string[];
  readonly linkLines: readonly string[];
  readonly repoLines: readonly string[];
  readonly goalLines: readonly string[];
};

async function loadProjectBrief(
  userId: string,
  owned: Project,
): Promise<ProjectBriefBundle> {
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
          (link) => `- ${link.title} (id: ${link.id}, url: ${link.url})`,
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

  return { owned, fileLines, linkLines, repoLines, goalLines };
}

function formatActiveBrief(bundle: ProjectBriefBundle): string {
  const { owned, fileLines, linkLines, repoLines, goalLines } = bundle;
  const instructions = owned.instructions.trim();
  return [
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
  ].join("\n");
}

function formatReferencedBrief(bundle: ProjectBriefBundle): string {
  const { owned, fileLines, linkLines, repoLines, goalLines } = bundle;
  const instructions = owned.instructions.trim();
  return [
    `### ${owned.name} (id: ${owned.id})`,
    "",
    `Status: ${owned.status}`,
    `Priority: ${owned.priority}`,
    `Start date: ${owned.startDate ?? "(none)"}`,
    `Target date: ${owned.targetDate ?? "(none)"}`,
    "",
    instructions
      ? ["#### Project instructions", "", instructions].join("\n")
      : "#### Project instructions\n\n(none set)",
    "",
    "#### Active goals",
    "",
    ...goalLines,
    "",
    "#### Files",
    "",
    ...fileLines,
    "",
    "#### URL links",
    "",
    ...linkLines,
    "",
    "#### Repos",
    "",
    ...repoLines,
  ].join("\n");
}

export default defineDynamic(async (ctx) => {
  const messages = await ctx.messages();
  const intent = syncTurnClientIntent(messages);

  const auth = await requirePrincipalUser(ctx.session.auth.current);
  if ("error" in auth) return null;
  const { userId } = auth;

  const userText = latestUserText(messages);
  const mentions = extractProjectMentions(userText, 5);
  const verified: { id: string; label: string; owned: Project }[] = [];
  for (const mention of mentions) {
    const owned = await getProject(userId, mention.id);
    if (!owned) continue;
    verified.push({ id: owned.id, label: mention.label, owned });
  }

  const resolvedProjectId = resolveTurnProjectId({
    chatProjectId: intent.projectId,
    verifiedMentionIds: verified.map((row) => row.id),
  });

  if (resolvedProjectId && resolvedProjectId !== intent.projectId) {
    turnClientIntent.update((current) => ({
      ...current,
      projectId: resolvedProjectId,
    }));
  }

  const activeId = resolvedProjectId;
  const activeOwned = activeId
    ? verified.find((row) => row.id === activeId)?.owned ??
      (await getProject(userId, activeId))
    : null;

  const referenced = verified.filter((row) => row.id !== activeId);

  if (!activeOwned && referenced.length === 0) return null;

  const sections: string[] = [];
  sections.push(
    "Project mentions in the user message look like `:project[Name]{name=<id>}`.",
  );
  sections.push("");

  if (activeOwned) {
    const brief = await loadProjectBrief(userId, activeOwned);
    sections.push(formatActiveBrief(brief));
  }

  if (referenced.length > 0) {
    if (sections.length > 2) sections.push("");
    sections.push("# Referenced projects");
    sections.push("");
    sections.push(
      activeOwned
        ? "These projects were @-mentioned in the latest user message. They are"
        : "Several projects were @-mentioned and none is the chat default.",
      activeOwned
        ? "not the default workspace. Pass projectId to project tools to use them."
        : "Pass projectId to project tools; do not guess which one is active.",
      "",
    );
    for (const row of referenced) {
      const brief = await loadProjectBrief(userId, row.owned);
      sections.push(formatReferencedBrief(brief));
      sections.push("");
    }
  }

  const content = sections.join("\n").trim();
  if (!content) return null;

  return defineInstructions({
    content,
    role: "system",
  });
});
