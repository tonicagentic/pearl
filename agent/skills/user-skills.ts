import { defineDynamic, defineSkill } from "eve/skills";
import { listEnabledUserSkills } from "@/lib/db/skills";

/**
 * Resolve the signed-in user's enabled skills into eve's load_skill catalog.
 *
 * @remarks
 * Runs before every model call so a save in Settings → Skills is visible on the next
 * message without starting a new chat. Descriptions are advertised; bodies and
 * sibling files are written into the session sandbox when the set changes.
 * Non-user principals contribute nothing.
 */
export default defineDynamic(async (ctx) => {
  const principal = ctx.session.auth.current;
  if (principal?.principalType !== "user" || !principal.principalId) {
    return null;
  }

  const rows = await listEnabledUserSkills(principal.principalId);
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
