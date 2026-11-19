import { defineDynamic, defineRemoteAgent } from "eve";
import { bearer } from "eve/agents/auth";

import { readRemoteAgentIdMarker } from "../lib/connected-agent-selection.ts";
import { isBetterAuthUserPrincipal } from "../lib/user-connection.ts";
import { getConnectedAgentCredentialsForUser } from "@/lib/connected-agents/store";

type ConnectedSelection = {
  readonly id: string;
  readonly label: string;
  readonly url: string;
  readonly userId: string;
};

/**
 * Private eve deployments the user linked in Settings. Offered only when the
 * composer selected one of their own connections. Auth is the saved bearer —
 * never Pearl's Vercel OIDC identity.
 */
export default defineDynamic(async (ctx) => {
  const principal = ctx.session.auth.current;
  if (!isBetterAuthUserPrincipal(principal) || !principal?.principalId) {
    return null;
  }
  const userId = principal.principalId;

  const selection = await ctx.memo(
    ["connected-agent", ctx.turn?.id ?? null],
    async (): Promise<ConnectedSelection | null> => {
      const agentId = readRemoteAgentIdMarker(await ctx.messages());
      if (!agentId) return null;
      const creds = await getConnectedAgentCredentialsForUser(userId, agentId);
      if (!creds) return null;
      return {
        id: creds.id,
        label: creds.label,
        url: creds.url,
        userId,
      };
    },
  );

  if (!selection) return null;

  return defineRemoteAgent({
    url: selection.url,
    description:
      `Talk to the connected agent "${selection.label}". Pass the user's full ` +
      "message (and any needed context) in `message`. The remote agent never " +
      "sees this Pearl thread. Pass `taskId` from an earlier `connected` call " +
      "to continue that remote conversation; omit it when the user just switched " +
      "agents or this is the first call.",
    auth: bearer(async () => {
      const creds = await getConnectedAgentCredentialsForUser(
        selection.userId,
        selection.id,
      );
      if (!creds) {
        throw new Error("Connected agent is no longer available.");
      }
      return creds.token;
    }),
  });
});
