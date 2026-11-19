import type { AgentIntegrationId } from "@/lib/custom-agents/integrations";

import { integrationAllowed } from "./gate-integration.ts";
import { toolSurfaceEnabled } from "./lane-state.ts";

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

/** Expose a tool only when the tools lane is on and the integration is allowed. */
export function gatedToolExport<T>(
  connectionId: AgentIntegrationId,
  tool: T,
): (ctx: DynamicCtx) => Promise<T | null> {
  return async (ctx) => {
    if (!toolSurfaceEnabled()) return null;
    if (!(await integrationAllowed(ctx, connectionId))) return null;
    return tool;
  };
}
