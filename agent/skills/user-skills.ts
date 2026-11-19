import { defineDynamic, defineSkill } from "eve/skills";

import { listEnabledCustomAgentSkills } from "@/lib/custom-agents/config";
import { resolveActiveCustomAgent } from "@/lib/custom-agents/resolve-active";
import { listEnabledUserSkills } from "@/lib/db/skills";

import { principalUserId } from "../lib/principal.ts";

/**
 * Resolve skills for this turn: a custom agent's playbooks when one is
 * active, otherwise the signed-in user's Settings → Skills catalog.
 *
 * @remarks
 * Runs before every model call so a save in settings is visible on the next
 * message. Descriptions are advertised; bodies are written into the session
 * sandbox when the set changes. Non-user principals contribute nothing.
 */
export default defineDynamic(async (ctx) => {
  const userId = principalUserId(ctx.session.auth.current);
  if (!userId) return null;

  const messages = await ctx.messages();
  const agent = await resolveActiveCustomAgent({
    userId,
    messages,
    sessionId: ctx.session.id,
  });

  if (agent) {
    const rows = await listEnabledCustomAgentSkills(agent.id);
    if (rows.length === 0) return null;
    return Object.fromEntries(
      rows.map((row) => [
        row.slug,
        defineSkill({
          description: row.description,
          content: row.markdown,
        }),
      ]),
    );
  }

  const rows = await listEnabledUserSkills(userId);
  if (rows.length === 0) {
    return null;
  }

  return Object.fromEntries(
    rows.map((row) => [
      row.slug,
      defineSkill({
        description: row.description,
        content: row.markdown,
        ...(Object.keys(row.files ?? {}).length > 0
          ? { files: row.files }
          : {}),
      }),
    ]),
  );
});
