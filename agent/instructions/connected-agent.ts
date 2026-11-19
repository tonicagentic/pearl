import { defineDynamic, defineInstructions } from "eve/instructions";

import { readRemoteAgentIdMarker } from "../lib/connected-agent-selection.ts";
import { isBetterAuthUserPrincipal } from "../lib/user-connection.ts";
import { getConnectedAgentForUser } from "@/lib/connected-agents/store";

/**
 * When the composer selected a connected private agent, route the turn through
 * the `connected` remote-agent tool instead of answering as Pearl.
 */
export default defineDynamic(async (ctx) => {
  const principal = ctx.session.auth.current;
  if (!isBetterAuthUserPrincipal(principal) || !principal?.principalId) {
    return null;
  }

  const selection = await ctx.memo(
    ["connected-agent-instructions", ctx.turn?.id ?? null],
    async () => {
      const agentId = readRemoteAgentIdMarker(await ctx.messages());
      if (!agentId) return null;
      const row = await getConnectedAgentForUser(principal.principalId, agentId);
      if (!row) return null;
      return { id: row.id, label: row.label };
    },
  );

  if (!selection) return null;

  return defineInstructions({
    role: "system",
    content:
      `The user is talking to the connected agent "${selection.label}". ` +
      "Call the `connected` tool with their message as `message`. " +
      "If you already called `connected` earlier in this conversation for the " +
      "same agent and received a taskId, pass that taskId to continue. " +
      "Do not pass a taskId from a different agent or after the user switched. " +
      "Reply with the remote agent's answer. Do not answer the user's question " +
      "yourself, and do not call other tools unless the remote agent needs an " +
      "approval, question, or sign-in relayed through this session.",
  });
});
