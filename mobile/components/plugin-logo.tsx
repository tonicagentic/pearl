import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import type { ConnectionId } from "@/src/connections-client";

type LogoSpec = {
  readonly background: string;
  readonly foreground: string;
  readonly render: (color: string) => ReactNode;
};

const LOGOS: Record<ConnectionId, LogoSpec> = {
  gmail: {
    background: "#FCE8E6",
    foreground: "#EA4335",
    render: (color) => (
      <Path
        d="M2.5 5.5 12 12.25 21.5 5.5V18a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18V5.5Zm1.6-.75L12 10.4l7.9-5.65H4.1Z"
        fill={color}
      />
    ),
  },
  calendar: {
    background: "#E8F0FE",
    foreground: "#1A73E8",
    render: (color) => (
      <>
        <Rect x="4" y="5" width="16" height="15" rx="2" fill={color} />
        <Rect x="4" y="5" width="16" height="4" rx="2" fill={color} opacity={0.35} />
        <Path
          d="M8 3.5v3M16 3.5v3M8 13h3M13 13h3M8 16.5h3M13 16.5h3"
          stroke="#fff"
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </>
    ),
  },
  drive: {
    background: "#E6F4EA",
    foreground: "#0F9D58",
    render: (color) => (
      <Path
        d="M8.2 4.5h7.6L22 16.5h-7.6L8.2 4.5Zm-1.4 1.1L2 16.5h7.2l4.8-8.3-6.2-2.6Zm.6 12.4L12 11.2l4.6 6.8H7.4Z"
        fill={color}
      />
    ),
  },
  github: {
    background: "#F0F0F0",
    foreground: "#24292F",
    render: (color) => (
      <Path
        d="M12 2.2c-5.4 0-9.8 4.4-9.8 9.8 0 4.3 2.8 8 6.7 9.3.5.1.7-.2.7-.5v-1.7c-2.7.6-3.3-1.3-3.3-1.3-.4-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.7.4-1.1.7-1.3-2.2-.3-4.5-1.1-4.5-4.9 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1 .8-.2 1.6-.3 2.5-.3s1.7.1 2.5.3c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.8-2.3 4.6-4.5 4.9.4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5 3.9-1.3 6.7-5 6.7-9.3 0-5.4-4.4-9.8-9.8-9.8Z"
        fill={color}
      />
    ),
  },
  vercel: {
    background: "#F4F4F5",
    foreground: "#000000",
    render: (color) => (
      <Path d="M12 4.5 21 19.5H3L12 4.5Z" fill={color} />
    ),
  },
  xero: {
    background: "#E8F7F4",
    foreground: "#13B5EA",
    render: (color) => (
      <>
        <Circle cx="12" cy="12" r="8.5" fill={color} />
        <Path
          d="M8.2 8.2 15.8 15.8M15.8 8.2 8.2 15.8"
          stroke="#fff"
          strokeWidth={2.2}
          strokeLinecap="round"
        />
      </>
    ),
  },
  tempo: {
    background: "#EEF2FF",
    foreground: "#4F46E5",
    render: (color) => (
      <>
        <Circle
          cx="12"
          cy="12"
          r="8.5"
          fill="none"
          stroke={color}
          strokeWidth={2}
        />
        <Path
          d="M12 7.5V12l3 2"
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  sheets: {
    background: "#E6F4EA",
    foreground: "#0F9D58",
    render: (color) => (
      <>
        <Rect x="5" y="3.5" width="14" height="17" rx="2" fill={color} />
        <Path
          d="M8 9h8M8 12.5h8M8 16h8M12 9v7"
          stroke="#fff"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      </>
    ),
  },
  notion: {
    background: "#F1F1EF",
    foreground: "#000000",
    render: (color) => (
      <Path
        d="M6.2 4.8h10.2l1.4 1.2v12.4l-2.1 1.3H6.8L5.2 18.2V6.2l1-1.4Zm1.1 1.5v11.2l.9.6h7.7l1.1-.7V6.9l-.8-.6H7.3Zm2 1.6h1.5l3.6 8.4h-1.6l-.8-2H9.7l-.7 2H7.5l3.3-8.4h.5Zm1.2 1.7-.9 3.2h2.2l-1-3.2h-.3Z"
        fill={color}
      />
    ),
  },
  linear: {
    background: "#EEE9FF",
    foreground: "#5E6AD2",
    render: (color) => (
      <Path
        d="M4.8 14.7 14.7 4.8A7.2 7.2 0 0 0 4.8 14.7Zm1.7 3A7.2 7.2 0 0 0 17.7 6.5L6.5 17.7Zm3.1 1.5A7.2 7.2 0 0 0 19.2 9.6L9.6 19.2Z"
        fill={color}
      />
    ),
  },
  sentry: {
    background: "#FCE8E6",
    foreground: "#362D59",
    render: (color) => (
      <Path
        d="M13.9 4.4c.4-.7 1.1-1.1 1.9-1.1h2.2L12 14.2 6 3.3h2.2c.8 0 1.5.4 1.9 1.1L12 8l1.9-3.6ZM4.7 6.2 12 19.3 19.3 6.2h-2.5L12 14.2 7.2 6.2H4.7Z"
        fill={color}
      />
    ),
  },
};

/** Brand mark for a connection/plugin row. */
export function PluginLogo({
  id,
  size = 36,
}: {
  readonly id: ConnectionId;
  readonly size?: number;
}) {
  const spec = LOGOS[id];
  const fallbackBg = useCSSVariable("--color-muted") as string | undefined;
  const fallbackFg = useCSSVariable("--color-foreground") as string | undefined;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: spec?.background ?? fallbackBg,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24">
        {spec
          ? spec.render(spec.foreground)
          : (
              <Circle
                cx="12"
                cy="12"
                r="8"
                fill={fallbackFg}
              />
            )}
      </Svg>
    </View>
  );
}
