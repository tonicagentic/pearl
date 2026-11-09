"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  carryOutPlanAction,
  deletePlanAction,
  savePlanAction,
} from "@/app/actions/projects";
import { setAgentMode } from "@/app/_components/agent-mode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function PlanEditor({
  plan,
}: {
  readonly plan: {
    readonly id: string;
    readonly projectId: string;
    readonly title: string;
    readonly slug: string;
    readonly markdown: string;
  };
}) {
  const router = useRouter();
  const [title, setTitle] = useState(plan.title);
  const [markdown, setMarkdown] = useState(plan.markdown);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Render the markdown preview only after mount so remark-gfm output
  // cannot diverge between server HTML and the first client paint.
  const [previewReady, setPreviewReady] = useState(false);
  useEffect(() => {
    setPreviewReady(true);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-md"
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          value={title}
        />
        <Button
          disabled={pending || !title.trim()}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                await savePlanAction({
                  projectId: plan.projectId,
                  planId: plan.id,
                  title,
                  markdown,
                  slug: plan.slug,
                });
                router.refresh();
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Could not save the plan.",
                );
              }
            });
          }}
          size="sm"
          type="button"
        >
          Save
        </Button>
        <Button
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                setAgentMode("agent");
                const result = await carryOutPlanAction({ planId: plan.id });
                router.push(`/chat/${result.chatId}`);
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Could not start carrying out the plan.",
                );
              }
            });
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          Carry out
        </Button>
        <Button
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Delete plan “${plan.title}”?`)) return;
            setError(null);
            startTransition(async () => {
              try {
                await deletePlanAction({ planId: plan.id });
                router.push(`/projects/${plan.projectId}`);
                router.refresh();
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Could not delete the plan.",
                );
              }
            });
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          Delete
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Textarea
          className="min-h-[28rem] font-mono text-[13px] leading-5"
          onChange={(event) => setMarkdown(event.target.value)}
          value={markdown}
        />
        <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border bg-card px-4 py-3">
          {previewReady ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          ) : (
            <pre className="m-0 whitespace-pre-wrap font-mono text-[13px] leading-5 text-muted-foreground">
              {markdown}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
