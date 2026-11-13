import type { ReactNode } from "react";
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
} from "lucide-react";

import type { PluginMarkId } from "@/lib/plugins/catalog";
import { cn } from "@/lib/utils";

type BrandSpec = {
  readonly background: string;
  readonly mark: ReactNode;
};

type BuiltinSpec = {
  readonly background: string;
  readonly color: string;
  readonly icon: LucideIcon;
};

const BRAND_LOGOS: Partial<Record<PluginMarkId, BrandSpec>> = {
  gmail: {
    background: "#FCE8E6",
    mark: (
      <path
        d="M2.5 5.5 12 12.25 21.5 5.5V18a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18V5.5Zm1.6-.75L12 10.4l7.9-5.65H4.1Z"
        fill="#EA4335"
      />
    ),
  },
  calendar: {
    background: "#E8F0FE",
    mark: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" fill="#1A73E8" />
        <rect
          x="4"
          y="5"
          width="16"
          height="4"
          rx="2"
          fill="#1A73E8"
          opacity="0.35"
        />
        <path
          d="M8 3.5v3M16 3.5v3M8 13h3M13 13h3M8 16.5h3M13 16.5h3"
          fill="none"
          stroke="#fff"
          strokeLinecap="round"
          strokeWidth="1.6"
        />
      </>
    ),
  },
  drive: {
    background: "#E8F0FE",
    mark: (
      <>
        <path d="M8.2 4.5h7.6L22 16.5h-7.6L8.2 4.5Z" fill="#4285F4" />
        <path d="M6.8 5.6 2 16.5h7.2l4.8-8.3-7.2-2.6Z" fill="#0F9D58" />
        <path d="M7.4 18.5 12 11.2l4.6 7.3H7.4Z" fill="#F4B400" />
      </>
    ),
  },
  github: {
    background: "#F0F0F0",
    mark: (
      <path
        d="M12 2.2c-5.4 0-9.8 4.4-9.8 9.8 0 4.3 2.8 8 6.7 9.3.5.1.7-.2.7-.5v-1.7c-2.7.6-3.3-1.3-3.3-1.3-.4-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.7.4-1.1.7-1.3-2.2-.3-4.5-1.1-4.5-4.9 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1 .8-.2 1.6-.3 2.5-.3s1.7.1 2.5.3c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.8-2.3 4.6-4.5 4.9.4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5 3.9-1.3 6.7-5 6.7-9.3 0-5.4-4.4-9.8-9.8-9.8Z"
        fill="#24292F"
      />
    ),
  },
  vercel: {
    background: "#F4F4F5",
    mark: <path d="M12 4.5 21 19.5H3L12 4.5Z" fill="#000" />,
  },
  xero: {
    background: "#E8F7F4",
    mark: (
      <>
        <circle cx="12" cy="12" r="8.5" fill="#13B5EA" />
        <path
          d="M8.2 8.2 15.8 15.8M15.8 8.2 8.2 15.8"
          fill="none"
          stroke="#fff"
          strokeLinecap="round"
          strokeWidth="2.2"
        />
      </>
    ),
  },
  tempo: {
    background: "#EEF2FF",
    mark: (
      <>
        <circle
          cx="12"
          cy="12"
          r="8.5"
          fill="none"
          stroke="#4F46E5"
          strokeWidth="2"
        />
        <path
          d="M12 7.5V12l3 2"
          fill="none"
          stroke="#4F46E5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </>
    ),
  },
  sheets: {
    background: "#E6F4EA",
    mark: (
      <>
        <rect x="5" y="3.5" width="14" height="17" rx="2" fill="#0F9D58" />
        <path
          d="M8 9h8M8 12.5h8M8 16h8M12 9v7"
          fill="none"
          stroke="#fff"
          strokeLinecap="round"
          strokeWidth="1.4"
        />
      </>
    ),
  },
  expo: {
    background: "#1A1A1A",
    mark: (
      <path
        d="M12 3.5c-2.2 3.8-6.5 9.2-6.5 12.2a6.5 6.5 0 0 0 13 0c0-3-4.3-8.4-6.5-12.2Z"
        fill="#fff"
      />
    ),
  },
  shopify: {
    background: "#E8F8F0",
    mark: (
      <path
        d="M16.6 6.2c-.1 0-.3 0-.4.1l-.3-1c0-.1-.1-.1-.2-.1l-1.1.2c-.2-.5-.5-1-1-1.4-.7-.6-1.6-.8-2.5-.6-.3.1-.6.2-.8.4L8.6 3.4c-.1 0-.2 0-.2.1L8 4.6l-1.3.3c-.2 0-.3.2-.3.4L5.2 18c0 .2.1.3.3.4l10.2 2c.1 0 .1 0 .2 0 .1 0 .2-.1.2-.2l1.7-13.3c0-.2-.1-.4-.2-.5l-1-.2Zm-5.3-.8c.3 0 .5.1.7.2l-1.1.2.4-1.5c.3.2.5.6.5 1.1h-.5Zm1.8.4c0 .2 0 .3-.1.5l-1.5.3.5-1.8c.5.2.9.6 1.1 1Zm-4.4 2.2 1-.2.5 3.4c0 .1.1.1.2.1h.1c.1 0 .1-.1.1-.1l.5-2.4 1.1-.2-.6 3.2c-.1.3-.3.5-.6.5-.4.1-.7-.1-.8-.4l-.7-3.7-1.1.2.3-1.4c0-.1.1-.2.2-.2Zm7.2 8.5L8.8 17l.4-2.9 7.1 1.4-.4 1.8Z"
        fill="#95BF47"
      />
    ),
  },
  stripe: {
    background: "#E8F0FE",
    mark: (
      <path
        d="M12.4 9.3c-.9-.4-1.4-.6-1.4-1.1 0-.4.4-.7 1-.7.8 0 1.6.3 2.3.8V5.8A7.6 7.6 0 0 0 12 5.3c-2.5 0-4.2 1.3-4.2 3.5 0 2.7 3.5 3 3.5 4.5 0 .6-.5.9-1.2.9-1 0-2-.4-2.8-1v2.6c.9.4 1.9.6 2.9.6 2.6 0 4.4-1.3 4.4-3.5 0-2.9-3.6-3.1-3.6-4.6Z"
        fill="#635BFF"
      />
    ),
  },
  "icloud-calendar": {
    background: "#E8F0FE",
    mark: (
      <>
        <path
          d="M8.2 9.2a4.2 4.2 0 0 1 7.7-1.5A3.6 3.6 0 0 1 18.5 14H8.8a3.3 3.3 0 0 1-.6-6.5Z"
          fill="#007AFF"
        />
        <rect
          x="7"
          y="14.5"
          width="10"
          height="6"
          rx="1.5"
          fill="#007AFF"
          opacity="0.85"
        />
      </>
    ),
  },
  "icloud-drive": {
    background: "#E8F0FE",
    mark: (
      <path
        d="M8.2 10.2a4.2 4.2 0 0 1 7.7-1.5A3.6 3.6 0 0 1 18.5 15H8.8a3.3 3.3 0 0 1-.6-6.5Z"
        fill="#007AFF"
      />
    ),
  },
  "pearl-cloud": {
    background: "#F5F3FF",
    mark: (
      <path
        d="M7.5 15.5a3.2 3.2 0 0 1 .4-6.3 4.4 4.4 0 0 1 8.3 1.2A3 3 0 0 1 17 15.5H7.5Z"
        fill="#6D28D9"
      />
    ),
  },
  postgres: {
    background: "#E8F0FE",
    mark: (
      <path
        d="M12 3.5c-3.6 0-5.8 1.4-5.8 3.2v10.6c0 1.8 2.2 3.2 5.8 3.2s5.8-1.4 5.8-3.2V6.7c0-1.8-2.2-3.2-5.8-3.2Zm0 1.4c2.7 0 4.3.9 4.3 1.8S14.7 8.5 12 8.5 7.7 7.6 7.7 6.7 9.3 4.9 12 4.9Zm0 14.2c-2.7 0-4.3-.9-4.3-1.8v-1.2c1.1.7 2.7 1.1 4.3 1.1s3.2-.4 4.3-1.1v1.2c0 .9-1.6 1.8-4.3 1.8Z"
        fill="#336791"
      />
    ),
  },
  neon: {
    background: "#ECFDF5",
    mark: <path d="M7 19.5 17 4.5v9.2L7 19.5Z" fill="#00E599" />,
  },
  betterstack: {
    background: "#EEF2FF",
    mark: (
      <>
        <path d="M5.5 16.5 12 5.5l6.5 11H5.5Z" fill="#4F46E5" />
        <circle cx="12" cy="14.5" r="1.6" fill="#fff" />
      </>
    ),
  },
  brex: {
    background: "#F4F4F5",
    mark: (
      <path
        d="M6.5 6.5h6.2c2.4 0 4 1.4 4 3.4 0 1.4-.8 2.5-2.1 3l2.6 4.6h-3.1l-2.3-4.2H9.4v4.2H6.5V6.5Zm2.9 2.3v3.1h3c1.1 0 1.7-.5 1.7-1.5s-.6-1.6-1.7-1.6h-3Z"
        fill="#18181B"
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
  className,
}: {
  readonly id: PluginMarkId;
  readonly className?: string;
}) {
  const brand = BRAND_LOGOS[id];
  const builtin = BUILTIN_TILES[id];

  if (builtin) {
    const Lucide = builtin.icon;
    return (
      <span
        aria-hidden
        className={cn(
          "inline-flex size-10 shrink-0 items-center justify-center rounded-[11px]",
          className,
        )}
        style={{ backgroundColor: builtin.background }}
      >
        <Lucide className="size-5" style={{ color: builtin.color }} />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-muted",
        className,
      )}
      style={brand ? { backgroundColor: brand.background } : undefined}
    >
      <svg className="size-[22px]" viewBox="0 0 24 24">
        {brand?.mark}
      </svg>
    </span>
  );
}
