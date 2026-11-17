import { type ComponentType, type ReactNode } from "react";

type ObserveApi = {
  configure: (options: Record<string, unknown>) => void;
};

type ObserveRootProps = {
  readonly children?: ReactNode;
  readonly errorBoundaryFallback?: ComponentType<{
    readonly resetError: () => void;
  }>;
};

type ObserveModule = {
  Observe: ObserveApi;
  ObserveRoot: ComponentType<ObserveRootProps>;
  ObserveInteractiveMarker: ComponentType;
};

/**
 * expo-observe needs ExpoAppMetrics (not in Expo Go). Load it when present;
 * otherwise no-op so UI work can run in Go without a custom native binary.
 */
function loadObserve(): { module: ObserveModule; available: boolean } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-observe") as ObserveModule;
    return { module: mod, available: true };
  } catch {
    return {
      available: false,
      module: {
        Observe: {
          configure: () => {},
        },
        ObserveRoot: ({ children }: ObserveRootProps) => <>{children}</>,
        ObserveInteractiveMarker: () => null,
      },
    };
  }
}

const loaded = loadObserve();

export const Observe = loaded.module.Observe;
export const ObserveRoot = loaded.module.ObserveRoot;
export const ObserveInteractiveMarker = loaded.module.ObserveInteractiveMarker;
/** True when the real Observe native stack is available. */
export const observeAvailable = loaded.available;
