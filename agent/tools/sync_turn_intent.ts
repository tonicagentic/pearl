import { defineDynamic } from "eve/tools";

import { syncTurnClientIntent } from "#lib/turn-context.js";

// clientContext is spliced into model messages before each model call. Sync
// mode/projectId here so Plan-mode tool gates and turnClientIntent.get() see
// the composer's markers before tools run.

export default defineDynamic(async (ctx) => {
  syncTurnClientIntent(await ctx.messages());
  return null;
});
