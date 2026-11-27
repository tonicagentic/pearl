"use client";

import type { ComponentProps, ReactNode, RefObject } from "react";
import { KeyRoundIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { field, inkButton, mono, paper } from "./surfaces";
import { useReceiptFocus } from "./receipt-focus";

export type GrantScope = "session" | "always" | "denied";

/**
 * Capability grant card (docs: elements/permission-grant). Spells out what is
 * being asked, who asked, and the reach before the user commits. Resolved
 * scope swaps the action row for a receipt badge.
 */
export function PermissionGrant({
  capability,
  requester,
  reach,
  scope,
  onGrant,
  actions,
  icon,
  className,
  ...props
}: Omit<
  ComponentProps<"div">,
  "children" | "capability" | "requester" | "reach" | "scope" | "onGrant"
> & {
  capability: string;
  requester?: string;
  reach: readonly string[];
  scope: GrantScope | "pending";
  onGrant?: (scope: GrantScope) => void;
  /** Replaces Deny / This session / Always while pending (e.g. OAuth continue). */
  actions?: ReactNode;
  /** Brand mark; defaults to a key icon. */
  icon?: ReactNode;
}) {
  const { receiptRef, focusHandlers } = useReceiptFocus(props);
  return (
    <div
      data-slot="permission-grant"
      className={cn(
        paper,
        "bg-card flex w-full flex-col gap-3.5 rounded-[20px] p-4 dark:bg-card",
        className,
      )}
      {...props}
      {...focusHandlers}
    >
      <div className="flex items-start gap-2.5">
        {icon ?? (
          <KeyRoundIcon
            aria-hidden
            className="text-muted-foreground mt-0.5 size-4 shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-sm font-medium leading-snug">
            {capability}
          </p>
          {requester ? (
            <p className="text-muted-foreground mt-0.5 text-xs">
              requested by {requester}
            </p>
          ) : null}
        </div>
      </div>

      {reach.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className={cn(mono, "text-muted-foreground")}>this grants</span>
          {reach.map((item) => (
            <span
              key={item}
              className="text-foreground/60 flex items-baseline gap-2 text-xs leading-snug"
            >
              <span
                aria-hidden
                className="bg-foreground/20 mt-1.5 size-1 shrink-0 rounded-full"
              />
              <span className="min-w-0 break-all">{item}</span>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {scope === "pending" ? (
          actions !== undefined ? (
            actions
          ) : onGrant ? (
            <>
              <button
                type="button"
                onClick={() => onGrant("denied")}
                className="text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground/90 h-8 rounded-full px-3 text-xs font-medium transition-[background-color,color,scale] duration-150 active:scale-[0.96]"
              >
                Deny
              </button>
              <button
                type="button"
                onClick={() => onGrant("session")}
                className="text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground/90 h-8 rounded-full px-3 text-xs font-medium transition-[background-color,color,scale] duration-150 active:scale-[0.96]"
              >
                This session
              </button>
              <button
                type="button"
                onClick={() => onGrant("always")}
                className={cn(
                  inkButton,
                  "flex h-8 items-center rounded-full px-3 text-xs font-medium",
                )}
              >
                Always
              </button>
            </>
          ) : (
            <span
              key={scope}
              className={cn(
                field,
                mono,
                "fade-in animate-in text-muted-foreground rounded-full px-2.5 py-1.5 duration-300",
              )}
            >
              pending
            </span>
          )
        ) : (
          <span
            key={scope}
            ref={receiptRef as RefObject<HTMLSpanElement>}
            tabIndex={-1}
            className={cn(
              field,
              mono,
              "fade-in animate-in text-muted-foreground rounded-full px-2.5 py-1.5 duration-300 outline-none",
            )}
          >
            {scope === "denied" ? "denied" : `granted · ${scope}`}
          </span>
        )}
      </div>
    </div>
  );
}
