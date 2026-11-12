import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import { useCSSVariable } from "uniwind";
import {
  BarChart3Icon,
  Code2Icon,
  FolderKanbanIcon,
  GlobeIcon,
  ListTodoIcon,
  PaletteIcon,
  SearchIcon,
  ShapesIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react-native";

import { Icon } from "@/components/ui/icon";
import type { PluginMarkId } from "../../lib/plugins/catalog";

type BrandSpec = {
  readonly background: string;
  readonly foreground: string;
  readonly render: (color: string) => ReactNode;
};

type BuiltinSpec = {
  readonly background: string;
  readonly color: string;
  readonly icon: LucideIcon;
};

const BRAND_LOGOS: Partial<Record<PluginMarkId, BrandSpec>> = {
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
        <Rect
          x="4"
          y="5"
          width="16"
          height="4"
          rx="2"
          fill={color}
          opacity={0.35}
        />
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
    background: "#E8F0FE",
    foreground: "#4285F4",
    render: () => (
      <>
        <Path d="M8.2 4.5h7.6L22 16.5h-7.6L8.2 4.5Z" fill="#4285F4" />
        <Path d="M6.8 5.6 2 16.5h7.2l4.8-8.3-7.2-2.6Z" fill="#0F9D58" />
        <Path d="M7.4 18.5 12 11.2l4.6 7.3H7.4Z" fill="#F4B400" />
      </>
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
    render: (color) => <Path d="M12 4.5 21 19.5H3L12 4.5Z" fill={color} />,
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
  expo: {
    background: "#1A1A1A",
    foreground: "#FFFFFF",
    render: (color) => (
      <Path
        d="M12 3.5c-2.2 3.8-6.5 9.2-6.5 12.2a6.5 6.5 0 0 0 13 0c0-3-4.3-8.4-6.5-12.2Z"
        fill={color}
      />
    ),
  },
  shopify: {
    background: "#E8F8F0",
    foreground: "#95BF47",
    render: (color) => (
      <Path
        d="M16.6 6.2c-.1 0-.3 0-.4.1l-.3-1c0-.1-.1-.1-.2-.1l-1.1.2c-.2-.5-.5-1-1-1.4-.7-.6-1.6-.8-2.5-.6-.3.1-.6.2-.8.4L8.6 3.4c-.1 0-.2 0-.2.1L8 4.6l-1.3.3c-.2 0-.3.2-.3.4L5.2 18c0 .2.1.3.3.4l10.2 2c.1 0 .1 0 .2 0 .1 0 .2-.1.2-.2l1.7-13.3c0-.2-.1-.4-.2-.5l-1-.2Zm-5.3-.8c.3 0 .5.1.7.2l-1.1.2.4-1.5c.3.2.5.6.5 1.1h-.5Zm1.8.4c0 .2 0 .3-.1.5l-1.5.3.5-1.8c.5.2.9.6 1.1 1Zm-4.4 2.2 1-.2.5 3.4c0 .1.1.1.2.1h.1c.1 0 .1-.1.1-.1l.5-2.4 1.1-.2-.6 3.2c-.1.3-.3.5-.6.5-.4.1-.7-.1-.8-.4l-.7-3.7-1.1.2.3-1.4c0-.1.1-.2.2-.2Zm7.2 8.5L8.8 17l.4-2.9 7.1 1.4-.4 1.8Z"
        fill={color}
      />
    ),
  },
  stripe: {
    background: "#E8F0FE",
    foreground: "#635BFF",
    render: (color) => (
      <Path
        d="M12.4 9.3c-.9-.4-1.4-.6-1.4-1.1 0-.4.4-.7 1-.7.8 0 1.6.3 2.3.8V5.8A7.6 7.6 0 0 0 12 5.3c-2.5 0-4.2 1.3-4.2 3.5 0 2.7 3.5 3 3.5 4.5 0 .6-.5.9-1.2.9-1 0-2-.4-2.8-1v2.6c.9.4 1.9.6 2.9.6 2.6 0 4.4-1.3 4.4-3.5 0-2.9-3.6-3.1-3.6-4.6Z"
        fill={color}
      />
    ),
  },
};

const BUILTIN_TILES: Partial<Record<PluginMarkId, BuiltinSpec>> = {
  browser: { background: "#E8F0FE", icon: GlobeIcon, color: "#1A73E8" },
  search: { background: "#F3E8FF", icon: SearchIcon, color: "#7C3AED" },
  coder: { background: "#ECFDF5", icon: Code2Icon, color: "#059669" },
  projects: {
    background: "#FFF7ED",
    icon: FolderKanbanIcon,
    color: "#EA580C",
  },
  researcher: { background: "#EEF2FF", icon: SearchIcon, color: "#4F46E5" },
  analyst: { background: "#ECFEFF", icon: BarChart3Icon, color: "#0891B2" },
  designer: { background: "#FDF2F8", icon: PaletteIcon, color: "#DB2777" },
  "schema-designer": {
    background: "#EEF2FF",
    icon: ShapesIcon,
    color: "#4338CA",
  },
  plan: { background: "#F0FDF4", icon: ListTodoIcon, color: "#16A34A" },
  tax: { background: "#FEF3C7", icon: WalletIcon, color: "#D97706" },
};

/** Brand or built-in mark for a plugin row. */
export function PluginLogo({
  id,
  size = 40,
}: {
  readonly id: PluginMarkId;
  readonly size?: number;
}) {
  const brand = BRAND_LOGOS[id];
  const builtin = BUILTIN_TILES[id];
  const fallbackBg = useCSSVariable("--color-muted") as string | undefined;
  const fallbackFg = useCSSVariable("--color-foreground") as string | undefined;

  if (builtin) {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.28,
          backgroundColor: builtin.background,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <Icon as={builtin.icon} size={size * 0.48} color={builtin.color} />
      </View>
    );
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: brand?.background ?? fallbackBg,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24">
        {brand ? (
          brand.render(brand.foreground)
        ) : (
          <Circle cx="12" cy="12" r="8" fill={fallbackFg} />
        )}
      </Svg>
    </View>
  );
}
