import { defineDynamic } from "eve/tools";

import { syncTurnClientIntent } from "#lib/turn-context.js";

// clientContext is spliced into model messages for step.started, not for
// turn.started. Sync mode/projectId here so Plan-mode tool gates and
// turnClientIntent.get() see the composer's markers before tools run.

export default defineDynamic({
  events: {
    "step.started": (_event, ctx) => {
      syncTurnClientIntent(ctx.messages);
      return null;
    },
  },
});
