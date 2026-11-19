import {
  listCustomAgentIntegrationIds,
} from "@/lib/custom-agents/config";
import { resolveActiveCustomAgent } from "@/lib/custom-agents/resolve-active";
import type { AgentIntegrationId } from "@/lib/custom-agents/integrations";

import { principalUserId } from "./principal.ts";

type AuthPrincipal = {
  readonly principalId?: string;
  readonly principalType?: string;
} | null;

type MessageLike = {
  readonly role: string;
  readonly content: unknown;
  readonly kind?: unknown;
};

/**
 * When a custom agent is active, only listed integrations are allowed.
 * When no custom agent is active, returns null (no gate — Pearl as usual).
 */
export async function customAgentIntegrationAllowlist(input: {
  readonly auth: AuthPrincipal;
  readonly messages: readonly MessageLike[];
  readonly sessionId: string;
}): Promise<ReadonlySet<AgentIntegrationId> | null> {
  const userId = principalUserId(input.auth);
  if (!userId) return null;

  const agent = await resolveActiveCustomAgent({
    userId,
    messages: input.messages,
    sessionId: input.sessionId,
  });
  if (!agent) return null;

  const ids = await listCustomAgentIntegrationIds(agent.id);
  return new Set(ids);
}

export async function customAgentAllowsIntegration(input: {
  readonly auth: AuthPrincipal;
  readonly messages: readonly MessageLike[];
  readonly sessionId: string;
  readonly connectionId: AgentIntegrationId;
}): Promise<boolean> {
  const allowlist = await customAgentIntegrationAllowlist(input);
  if (allowlist === null) return true;
  return allowlist.has(input.connectionId);
}
