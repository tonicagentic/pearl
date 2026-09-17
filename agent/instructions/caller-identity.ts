import { defineDynamic, defineInstructions } from "eve/instructions";
import { callerIdentity } from "../../lib/agent/session-context.ts";

// Tells the agent who it is talking to, resolved once per session from the
// authenticated principal (lib/eve-auth.ts builds it). System-role context:
// stable for the session's lifetime. Contributes nothing when there is no
// principal (unauthenticated surfaces).

export default defineDynamic({
  events: {
    "session.started": (_event, ctx) => {
      const content = callerIdentity(ctx.session.auth.current);

      return content
        ? defineInstructions({ content, role: "system" })
        : null;
    },
  },
});
