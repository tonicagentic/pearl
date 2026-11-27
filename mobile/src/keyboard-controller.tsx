import {
  type ComponentType,
  type PropsWithChildren,
  type ReactNode,
  type Ref,
} from "react";
import { View, type ViewProps } from "react-native";

/**
 * `react-native-keyboard-controller` throws while loading in Expo Go (its
 * native module is not in that binary). Dev builds get the real package;
 * Expo Go gets no-ops so the UI can still open.
 */
type KeyboardHandler = {
  onStart?: (e: { height: number; duration: number }) => void;
  onMove?: (e: { height: number; duration: number }) => void;
  onInteractive?: (e: { height: number; duration: number }) => void;
  onEnd?: (e: { height: number; duration: number }) => void;
};

type KeyboardControllerApi = {
  isVisible: () => boolean;
  state: () => { height: number };
  dismiss: (options?: {
    keepFocus?: boolean;
    animated?: boolean;
  }) => Promise<void>;
};

type KeyboardStickyViewProps = {
  readonly offset?: {
    readonly closed?: number;
    readonly opened?: number;
  };
  readonly enabled?: boolean;
} & ViewProps;

type KeyboardModule = {
  KeyboardProvider: ComponentType<{
    children?: ReactNode;
    enabled?: boolean;
  }>;
  KeyboardController: KeyboardControllerApi;
  KeyboardStickyView: ComponentType<
    PropsWithChildren<KeyboardStickyViewProps> & {
      ref?: Ref<View>;
    }
  >;
  useKeyboardHandler: (handler: KeyboardHandler, deps?: unknown[]) => void;
};

function loadKeyboardController(): KeyboardModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-keyboard-controller") as KeyboardModule;
  } catch {
    return null;
  }
}

const loaded = loadKeyboardController();

function FallbackKeyboardProvider({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

function FallbackKeyboardStickyView({
  children,
  style,
  ...props
}: PropsWithChildren<KeyboardStickyViewProps>) {
  return (
    <View style={style} {...props}>
      {children}
    </View>
  );
}

const fallbackController: KeyboardControllerApi = {
  isVisible: () => false,
  state: () => ({ height: 0 }),
  dismiss: async () => {},
};

export const KeyboardProvider =
  loaded?.KeyboardProvider ?? FallbackKeyboardProvider;

export const KeyboardController: KeyboardControllerApi =
  loaded?.KeyboardController ?? fallbackController;

export const KeyboardStickyView =
  loaded?.KeyboardStickyView ?? FallbackKeyboardStickyView;

export type { KeyboardStickyViewProps };

export function useKeyboardHandler(
  handler: KeyboardHandler,
  deps?: readonly unknown[],
): void {
  if (!loaded) return;
  loaded.useKeyboardHandler(handler, deps as unknown[]);
}
