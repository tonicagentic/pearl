import { defineSandbox } from "eve/sandbox";
import { getChatIdByEveSessionId, listAgentFileSeeds } from "@/lib/db/queries";

// Files the agent writes survive across turns inside one session sandbox,
// but a new session starts empty. Re-seed files persisted for this chat so
// the agent can pick up where earlier sessions left off. Seeding is
// best-effort: a database hiccup must not block sandbox startup.
export default defineSandbox({
  async onSession({ ctx, use }) {
    const session = await use();

    try {
      const chatId = await getChatIdByEveSessionId(ctx.session.id);

      if (!chatId) {
        return;
      }

      const seeds = await listAgentFileSeeds(chatId);

      for (const seed of seeds) {
        await session.writeTextFile({
          path: seed.path,
          content: seed.content,
        });
      }
    } catch {
      // Sandbox still starts empty; the turn proceeds without re-seeded files.
    }
  },
});
