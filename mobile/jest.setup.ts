jest.mock("@/components/assistant-ui/elements/surfaces", () => ({
  inkButton: "bg-foreground",
  useAnnounce: () => {},
  useMotion: () => false,
  useHydrated: () => true,
  webLiveRegion: undefined,
}));

// WaitingActionCard falls back to View when motion is off; keep a stub so
// importing react-native-reanimated does not load native worklets in Jest.
jest.mock("react-native-reanimated", () => {
  const ReactLocal = require("react");
  const RN = require("react-native");
  const Passthrough = ReactLocal.forwardRef(
    (props: Record<string, unknown>, ref: unknown) =>
      ReactLocal.createElement(RN.View, { ...props, ref }),
  );
  const chain = () => {
    const api: Record<string, unknown> = {};
    api.springify = () => api;
    api.damping = () => api;
    api.stiffness = () => api;
    api.delay = () => api;
    api.duration = () => api;
    api.withInitialValues = () => undefined;
    return api;
  };
  return {
    __esModule: true,
    default: { View: Passthrough, createAnimatedComponent: (c: unknown) => c },
    FadeInDown: chain(),
  };
});
