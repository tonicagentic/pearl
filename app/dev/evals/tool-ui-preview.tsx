"use client";

import { useState } from "react";
import { GlobeIcon, ImageIcon, MonitorIcon } from "lucide-react";

import { ArtifactCard } from "@/components/assistant-ui/elements/artifact-card";
import { TaskCard } from "@/components/assistant-ui/elements/task-card";
import {
  ToolTimeline,
} from "@/components/assistant-ui/elements/tool-timeline";
import {
  resolveToolUiPresentation,
  toolUiSurfaceLabel,
  type ToolUiPresentation,
  type ToolUiSurface,
} from "@/lib/dev/tool-ui-presentation";
import { cn } from "@/lib/utils";

function surfaceTone(surface: ToolUiSurface): string {
  switch (surface) {
    case "task_card":
      return "bg-emerald-500/10 text-emerald-950 dark:text-emerald-100";
    case "artifact_card":
      return "bg-sky-500/10 text-sky-950 dark:text-sky-100";
    case "image_card":
    case "svg_card":
      return "bg-fuchsia-500/10 text-fuchsia-950 dark:text-fuchsia-100";
    case "browser_chip":
    case "desktop_chip":
      return "bg-violet-500/10 text-violet-950 dark:text-violet-100";
    case "hidden":
      return "bg-muted/60 text-muted-foreground";
    case "fallback":
      return "bg-amber-500/10 text-amber-950 dark:text-amber-100";
    default:
      return "bg-muted/40 text-muted-foreground";
  }
}

function PreviewChrome({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border bg-background overflow-hidden rounded-lg border">
      <div className="border-border bg-muted/30 text-muted-foreground border-b px-3 py-1.5 text-[10px] font-medium tracking-wide uppercase">
        {title}
      </div>
      <div className="bg-background px-3 py-3">{children}</div>
    </div>
  );
}

function TimelinePreview({
  presentation,
  toolName,
}: {
  presentation: ToolUiPresentation;
  toolName: string;
}) {
  const [open, setOpen] = useState(true);
  const verb = presentation.timelineVerb ?? "Called";
  const chip = presentation.timelineChip ?? toolName;
  return (
    <PreviewChrome title="Session timeline (settled)">
      <ToolTimeline
        steps={[
          { verb, chip, detail: undefined },
          {
            verb: "Thought",
            chip: "",
            detail: "Sample reasoning folded above the tools.",
          },
        ]}
        visibleSteps={2}
        streaming={false}
        open={open}
        onOpenChange={setOpen}
        restingLabel="Worked"
        activeLabel="Working"
        elapsed="2.4s"
      />
    </PreviewChrome>
  );
}

function TaskCardPreview({ toolName }: { toolName: string }) {
  const label =
    toolName === "coder"
      ? "Building preview deploy"
      : toolName === "updates"
        ? "Morning brief"
        : toolName === "mail"
          ? "Inbox triage"
          : toolName === "designer"
            ? "App Store icons"
            : toolName === "list-builder"
              ? "Lead list"
              : `Running ${toolName}`;
  return (
    <div className="space-y-3">
      <PreviewChrome title="While running">
        <TaskCard
          label={label}
          meta={toolName}
          activity="Calling tools…"
          state="working"
          startedAt={Date.now() - 4200}
        />
      </PreviewChrome>
      <PreviewChrome title="Settled">
        <TaskCard
          label={label}
          meta={toolName}
          state="done"
          elapsed="4.2s"
          result={
            <p className="text-muted-foreground line-clamp-2 text-[12.5px] leading-snug">
              Sample handoff strip — PR, file link, or brief summary.
            </p>
          }
        />
      </PreviewChrome>
    </div>
  );
}

function ArtifactPreview() {
  return (
    <div className="space-y-3">
      <PreviewChrome title="While writing">
        <ArtifactCard
          title="/workspace/notes/outline.md"
          meta="Writing…"
          generating
          words={42}
        />
      </PreviewChrome>
      <PreviewChrome title="Settled">
        <ArtifactCard
          title="/workspace/notes/outline.md"
          meta="1.2 KB · created"
          words={180}
        />
      </PreviewChrome>
    </div>
  );
}

function ImagePreview() {
  return (
    <PreviewChrome title="While generating">
      <div
        className="bg-muted/50 relative flex w-full max-w-sm flex-col items-center justify-center gap-2 overflow-hidden rounded-lg p-6 text-center"
        style={{ aspectRatio: "1" }}
        role="status"
      >
        <ImageIcon className="text-muted-foreground size-8" />
        <p className="text-foreground text-sm font-medium">Generating image…</p>
        <p className="text-muted-foreground line-clamp-2 max-w-prose text-xs">
          Soft product hero on a warm desk, soft daylight
        </p>
      </div>
    </PreviewChrome>
  );
}

function SvgPreview() {
  return (
    <PreviewChrome title="Settled SVG / mark">
      <ArtifactCard
        title="/workspace/design/mark.svg"
        meta="2.1 KB · created"
        words={0}
      />
    </PreviewChrome>
  );
}

function ChipPreview({
  kind,
}: {
  kind: "browser" | "desktop";
}) {
  const Icon = kind === "browser" ? GlobeIcon : MonitorIcon;
  const label =
    kind === "browser" ? "Browse https://example.com" : "Desktop · start";
  return (
    <PreviewChrome title="In-thread chip">
      <div className="border-foreground/[0.08] text-foreground/70 flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-[13px]">
        <Icon className="size-3.5 shrink-0 opacity-60" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="text-foreground/40 text-[12px]">
          {kind === "browser" ? "example.com" : "streaming"}
        </span>
      </div>
    </PreviewChrome>
  );
}

function HiddenPreview() {
  return (
    <PreviewChrome title="No card">
      <p className="text-muted-foreground text-xs leading-5">
        This tool does not mount a dedicated card. Updates are reflected in the
        timeline / composer chrome only.
      </p>
    </PreviewChrome>
  );
}

function FallbackNote() {
  return (
    <PreviewChrome title="When approval is required">
      <div className="border-border bg-muted/20 rounded-md border px-3 py-2">
        <div className="text-xs font-medium">Approve tool call</div>
        <p className="text-muted-foreground mt-1 text-[11px] leading-4">
          Parked HITL calls leave the timeline and mount{" "}
          <code className="text-[10px]">ToolFallback</code> with Accept /
          Reject (and optional note).
        </p>
      </div>
    </PreviewChrome>
  );
}

export function ToolUiPreview({
  toolName,
  toolKind,
}: {
  toolName: string;
  toolKind?: string;
}) {
  const presentation = resolveToolUiPresentation(toolName, { kind: toolKind });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Chat UI
        </h3>
        <span
          className={cn(
            "rounded-md border border-transparent px-1.5 py-0.5 text-[10px] font-medium",
            surfaceTone(presentation.surface),
          )}
        >
          {toolUiSurfaceLabel(presentation.surface)}
        </span>
      </div>
      <p className="text-muted-foreground text-xs leading-5">
        {presentation.summary}
      </p>
      <ToolUiPreviewBody
        toolName={toolName}
        presentation={presentation}
      />
      {presentation.surface === "timeline" ||
      presentation.surface === "fallback" ? (
        <FallbackNote />
      ) : null}
    </section>
  );
}

function ToolUiPreviewBody({
  toolName,
  presentation,
}: {
  toolName: string;
  presentation: ToolUiPresentation;
}) {
  switch (presentation.surface) {
    case "task_card":
      return <TaskCardPreview toolName={toolName} />;
    case "artifact_card":
      return <ArtifactPreview />;
    case "image_card":
      return <ImagePreview />;
    case "svg_card":
      return <SvgPreview />;
    case "browser_chip":
      return <ChipPreview kind="browser" />;
    case "desktop_chip":
      return <ChipPreview kind="desktop" />;
    case "hidden":
      return <HiddenPreview />;
    case "fallback":
      return <FallbackNote />;
    case "timeline":
    default:
      return (
        <TimelinePreview presentation={presentation} toolName={toolName} />
      );
  }
}

/** Compact chip for the tools list row. */
export function ToolUiSurfaceChip({
  toolName,
  toolKind,
}: {
  toolName: string;
  toolKind?: string;
}) {
  const presentation = resolveToolUiPresentation(toolName, { kind: toolKind });
  return (
    <span
      className={cn(
        "rounded-md border border-transparent px-1.5 py-0.5 text-[10px] font-medium",
        surfaceTone(presentation.surface),
      )}
      title={presentation.summary}
    >
      {toolUiSurfaceLabel(presentation.surface)}
    </span>
  );
}
