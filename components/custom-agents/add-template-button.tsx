"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { addAgentFromTemplateAction } from "@/app/actions/agent-templates";
import { ProjectPickerDialog } from "@/app/_components/project-picker-dialog";
import { Button } from "@/components/ui/button";

export function AddTemplateButton({
  slug,
  addedChatId,
  projectId = null,
  size = "sm",
}: {
  readonly slug: string;
  readonly addedChatId: string | null;
  readonly projectId?: string | null;
  readonly size?: "sm" | "default";
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (addedChatId && projectId) {
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

  const addToProject = (targetProjectId: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const row = await addAgentFromTemplateAction({
          slug,
          projectId: targetProjectId,
        });
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
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        disabled={pending}
        onClick={() => {
          if (projectId) {
            addToProject(projectId);
            return;
          }
          setPickerOpen(true);
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
      {!projectId ? (
        <ProjectPickerDialog
          description="Agents belong to a project. Pick one to add this template into, or create a new project."
          onOpenChange={setPickerOpen}
          onSelect={(project) => {
            addToProject(project.id);
          }}
          open={pickerOpen}
          title="Add to project"
        />
      ) : null}
    </div>
  );
}
