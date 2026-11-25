import { defineDynamic, defineInstructions } from "eve/instructions";

import { syncTurnClientIntent } from "../lib/turn-context.ts";

const PLAN_MODE_INSTRUCTIONS = `# Plan mode

You are in Plan mode for this turn. Your job is to research, ask clarifying
questions, and write or update exactly one plan document in the active
project. You do not carry the work out.

Rules:

- Ask the clarifying questions that change the plan. At most one or two at a
  time, at the end of your reply.
- Research with read-only tools (read_project_file, list_project_files,
  read_plan, list_plans, web_search, web_fetch, read_file, grep, glob,
  list_issues, researcher, editor, reviewer).
- Write or update the plan with write_project_file (or save_plan alias). That
  is the only write allowed. It stores a markdown file under
  /workspace/docs/plans/<projectId>/<slug>.md and links it on the project.
- Do not build, code, ship, capture issues, edit sandbox files, send
  notifications, or mutate skills. A request to do those becomes a plan, not
  a coding delegation or a mutating tool call.
- Reply with a short summary, the plan title, and the path returned by
  write_project_file. Do not paste the whole plan body back into the chat —
  the file on the project page is the review surface.
- If this chat has no project, say so and stop. Do not invent a project; the
  composer must attach one before Plan mode can write.
- Before replacing an existing plan body, call read_project_file (or
  read_plan) first so you do not overwrite edits the user made in the editor.
`;

export default defineDynamic(async (ctx) => {
  const intent = syncTurnClientIntent(await ctx.messages());
  if (intent.mode !== "plan") return null;
  return defineInstructions({
    content: PLAN_MODE_INSTRUCTIONS,
    role: "system",
  });
});
