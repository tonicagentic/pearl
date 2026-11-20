"use client";

import { useMemo, type FC } from "react";
import {
  ActionProvider,
  Renderer,
  StateProvider,
  VisibilityProvider,
} from "@json-render/react";
import type { Spec } from "@json-render/core";
import { chatRegistry } from "@/components/json-render/registry";

/**
 * Product json-render cards on marketing pages. Buttons render; reply is a no-op.
 */
export const MarketingJsonCard: FC<{
  readonly spec: Spec;
}> = ({ spec }) => {
  const handlers = useMemo(
    () => ({
      reply: async () => undefined,
    }),
    [],
  );

  return (
    <div data-slot="marketing-json-render" className="my-1 max-w-full">
      <StateProvider initialState={spec.state ?? {}}>
        <VisibilityProvider>
          <ActionProvider handlers={handlers}>
            <Renderer
              spec={spec}
              registry={chatRegistry}
              loading={false}
              fallback={() => null}
            />
          </ActionProvider>
        </VisibilityProvider>
      </StateProvider>
    </div>
  );
};
