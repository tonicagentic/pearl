import type { ReactNode } from "react";
import type { ConnectionId } from "@/lib/connections/catalog";
import { cn } from "@/lib/utils";

type LogoSpec = {
  readonly background: string;
  readonly mark: ReactNode;
};

const LOGOS: Record<ConnectionId, LogoSpec> = {
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
        <rect x="4" y="5" width="16" height="4" rx="2" fill="#1A73E8" opacity="0.35" />
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
    background: "#E6F4EA",
    mark: (
      <path
        d="M8.2 4.5h7.6L22 16.5h-7.6L8.2 4.5Zm-1.4 1.1L2 16.5h7.2l4.8-8.3-6.2-2.6Zm.6 12.4L12 11.2l4.6 6.8H7.4Z"
        fill="#0F9D58"
      />
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
  notion: {
    background: "#F1F1EF",
    mark: (
      <path
        d="M6.2 4.8h10.2l1.4 1.2v12.4l-2.1 1.3H6.8L5.2 18.2V6.2l1-1.4Zm1.1 1.5v11.2l.9.6h7.7l1.1-.7V6.9l-.8-.6H7.3Zm2 1.6h1.5l3.6 8.4h-1.6l-.8-2H9.7l-.7 2H7.5l3.3-8.4h.5Zm1.2 1.7-.9 3.2h2.2l-1-3.2h-.3Z"
        fill="#000"
      />
    ),
  },
  linear: {
    background: "#EEE9FF",
    mark: (
      <path
        d="M4.8 14.7 14.7 4.8A7.2 7.2 0 0 0 4.8 14.7Zm1.7 3A7.2 7.2 0 0 0 17.7 6.5L6.5 17.7Zm3.1 1.5A7.2 7.2 0 0 0 19.2 9.6L9.6 19.2Z"
        fill="#5E6AD2"
      />
    ),
  },
  sentry: {
    background: "#FCE8E6",
    mark: (
      <path
        d="M13.9 4.4c.4-.7 1.1-1.1 1.9-1.1h2.2L12 14.2 6 3.3h2.2c.8 0 1.5.4 1.9 1.1L12 8l1.9-3.6ZM4.7 6.2 12 19.3 19.3 6.2h-2.5L12 14.2 7.2 6.2H4.7Z"
        fill="#362D59"
      />
    ),
  },
};

/** Brand mark for a connection/plugin card. */
export function PluginLogo({
  id,
  className,
}: {
  readonly id: ConnectionId;
  readonly className?: string;
}) {
  const spec = LOGOS[id];

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px]",
        className,
      )}
      style={{ backgroundColor: spec.background }}
    >
      <svg className="size-[22px]" viewBox="0 0 24 24">
        {spec.mark}
      </svg>
    </span>
  );
}
