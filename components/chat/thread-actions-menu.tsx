"use client";

import { useState } from "react";
import { useEveEvents } from "@assistant-ui/eve";
import { CoinsIcon, EllipsisIcon, Trash2Icon } from "lucide-react";

import { useChatShell } from "@/app/_components/chat-shell-context";
import { ThreadCostDrawer } from "@/components/chat/thread-cost-drawer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ThreadTraceEvent } from "@/lib/usage/thread-trace";

/**
 * Thread-level actions for the open chat: cost breakdown drawer and delete.
 * Must render inside the eve runtime (uses `useEveEvents`).
 */
export function ThreadActionsMenu({
  chatId,
  className,
}: {
  readonly chatId: string | null;
  readonly className?: string;
}) {
  const { deleteChat, viewer } = useChatShell();
  const events = useEveEvents() as readonly ThreadTraceEvent[];
  const [costOpen, setCostOpen] = useState(false);
  const hasMessages = events.some(
    (event) =>
      event.type === "message.received" ||
      event.type === "step.started" ||
      event.type === "step.completed",
  );

  if (!hasMessages) {
    return null;
  }

  const onDelete = () => {
    if (!chatId) {
      return;
    }

    if (
      !window.confirm(
        "Delete this thread? This cannot be undone.",
      )
    ) {
      return;
    }

    void deleteChat(chatId);
  };

  return (
    <>
      <div
        className={cn(
          "pointer-events-auto",
          // Leave room for the signed-out auth controls in the shell chrome.
          !viewer && "mr-20 sm:mr-24",
          className,
        )}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="Thread actions"
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <EllipsisIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6}>
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setCostOpen(true);
              }}
            >
              <CoinsIcon className="size-4" />
              Cost
            </DropdownMenuItem>
            {chatId ? (
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  onDelete();
                }}
                variant="destructive"
              >
                <Trash2Icon className="size-4" />
                Delete
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ThreadCostDrawer
        open={costOpen}
        onOpenChange={setCostOpen}
        events={events}
      />
    </>
  );
}
