jest.mock("@/components/assistant-ui/elements/surfaces", () => ({
  inkButton: "bg-foreground",
  useAnnounce: () => {},
  useMotion: () => false,
  useHydrated: () => true,
  webLiveRegion: undefined,
}));

// eve ships ESM; Jest stays on CJS for RN. Stub the selectors we use in tests.
jest.mock("eve/events", () => ({
  emptySessionView: () => ({
    session: { status: "active", latestTurnId: undefined },
    turns: {},
    tasks: {},
    calls: {},
    interactions: {},
    changes: {},
    deliveries: {},
  }),
  activeTurn: (view: { turns?: Record<string, { status?: string }>; session?: { latestTurnId?: string } }) => {
    const id = view.session?.latestTurnId;
    if (!id) return undefined;
    const turn = view.turns?.[id];
    if (!turn || turn.status === "settled") return undefined;
    return turn;
  },
  idle: () => true,
  openInteractions: () => [],
  waiting: () => undefined,
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
  const interpolate = (
    value: number,
    input: number[],
    output: number[],
    _extrapolation?: unknown,
  ) => {
    if (input.length === 0) return output[0] ?? 0;
    const lo = Math.min(...input);
    const hi = Math.max(...input);
    // Match Reanimated CLAMP: outside the span, snap to the nearer endpoint.
    if (value <= lo) {
      const index = input.indexOf(lo);
      return output[index] ?? output[0]!;
    }
    if (value >= hi) {
      const index = input.indexOf(hi);
      return output[index] ?? output[output.length - 1]!;
    }
    for (let i = 0; i < input.length - 1; i++) {
      const left = input[i]!;
      const right = input[i + 1]!;
      const min = Math.min(left, right);
      const max = Math.max(left, right);
      if (value >= min && value <= max) {
        const t = right === left ? 0 : (value - left) / (right - left);
        return output[i]! + t * (output[i + 1]! - output[i]!);
      }
    }
    return output[output.length - 1]!;
  };
  const easingFn = (t: number) => t;
  return {
    __esModule: true,
    default: { View: Passthrough, createAnimatedComponent: (c: unknown) => c },
    FadeInDown: chain(),
    Easing: {
      linear: easingFn,
      cubic: easingFn,
      out: () => easingFn,
    },
    Extrapolation: { CLAMP: "clamp", IDENTITY: "identity", EXTEND: "extend" },
    interpolate,
  };
});
