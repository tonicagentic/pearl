import type { AgentIntegrationId } from "@/lib/custom-agents/integrations";

import { customAgentAllowsIntegration } from "./custom-agent-integrations.ts";

type DynamicCtx = {
  readonly session: {
    readonly id: string;
    readonly auth: { readonly current: unknown };
  };
  readonly messages: () => Promise<readonly unknown[]>;
  readonly memo: <T>(
    key: readonly unknown[],
    run: () => Promise<T> | T,
  ) => Promise<T>;
};

/**
 * Shared gate for MCP connections and first-party tools. When a custom agent
 * is active, only its allowlisted integrations pass.
 */
export async function integrationAllowed(
  ctx: DynamicCtx,
  connectionId: AgentIntegrationId,
): Promise<boolean> {
  const messages = await ctx.messages();
  return ctx.memo(
    ["custom-agent-integration", ctx.session.id, connectionId, messages.length],
    () =>
      customAgentAllowsIntegration({
        auth: ctx.session.auth.current as {
          readonly principalId?: string;
          readonly principalType?: string;
        } | null,
        messages: messages as readonly {
          readonly role: string;
          readonly content: unknown;
          readonly kind?: unknown;
        }[],
        sessionId: ctx.session.id,
        connectionId,
      }),
  );
}
