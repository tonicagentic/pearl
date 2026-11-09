import { defineDynamic } from "eve/instructions";

import { syncTurnClientIntent } from "../lib/turn-context.ts";

// Capture the composer's mode and projectId for this turn into durable
// session state so tools and gates can read them without
// re-parsing messages. Returns null: this file contributes no prompt text.

export default defineDynamic(async (ctx) => {
  syncTurnClientIntent(await ctx.messages());
  return null;
});
