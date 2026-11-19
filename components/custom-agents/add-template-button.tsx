"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { addAgentFromTemplateAction } from "@/app/actions/agent-templates";
import { Button } from "@/components/ui/button";

export function AddTemplateButton({
  slug,
  addedChatId,
  size = "sm",
}: {
  readonly slug: string;
  readonly addedChatId: string | null;
  readonly size?: "sm" | "default";
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (addedChatId) {
    return (
      <Button
        onClick={() => router.push(`/chat/${addedChatId}`)}
        size={size}
        type="button"
        variant="secondary"
      >
        Added
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const row = await addAgentFromTemplateAction({ slug });
              router.push(`/chat/${row.chatId}`);
              router.refresh();
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Could not add this agent.",
              );
            }
          });
        }}
        size={size}
        type="button"
      >
        {pending ? "Adding…" : "Add"}
      </Button>
      {error ? (
        <p className="max-w-[14rem] text-right text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
