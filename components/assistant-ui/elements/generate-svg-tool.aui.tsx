"use client";

import { makeAssistantToolUI } from "@assistant-ui/react";
import { ImageIcon, ImageOffIcon } from "lucide-react";

import { WorkspaceSvgPreview } from "@/components/assistant-ui/elements/workspace-svg-preview";
import { fileBasename } from "@/lib/design/file-preview";
import { cn } from "@/lib/utils";
import { mono, paper } from "@/lib/surfaces";

type GenerateSvgArgs = {
  readonly prompt?: string;
  readonly filePath?: string;
  readonly maxOutputTokens?: number;
};

type GenerateSvgResult = {
  readonly success?: boolean;
  readonly error?: string;
  readonly filePath?: string;
  readonly model?: string;
  readonly prompt?: string;
};

function truncatePrompt(prompt: string | undefined, max = 120): string {
  const trimmed = prompt?.trim() ?? "";
  if (!trimmed) return "";
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function parseResult(
  result: GenerateSvgResult | string | undefined,
): GenerateSvgResult | undefined {
  if (!result) return undefined;
  if (typeof result === "object") return result;
  try {
    const parsed = JSON.parse(result) as GenerateSvgResult;
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function GenerateSvgPlaceholder({
  args,
  label,
  detail,
  failed,
}: {
  readonly args?: GenerateSvgArgs;
  readonly label: string;
  readonly detail?: string;
  readonly failed?: boolean;
}) {
  const prompt = truncatePrompt(args?.prompt);

  return (
    <div
      data-slot="generate-svg-placeholder"
      className={cn(
        paper,
        "flex w-full max-w-sm flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl p-6 text-center",
        !failed && "animate-pulse motion-reduce:animate-none",
      )}
      role={failed ? undefined : "status"}
      aria-live={failed ? undefined : "polite"}
      aria-label={label}
    >
      {failed ? (
        <ImageOffIcon className="text-muted-foreground size-8" />
      ) : (
        <ImageIcon className="text-muted-foreground size-8" />
      )}
      <p className="text-foreground text-sm font-medium">{label}</p>
      {detail ? (
        <p className="text-muted-foreground line-clamp-3 max-w-prose text-xs">
          {detail}
        </p>
      ) : prompt ? (
        <p className="text-muted-foreground line-clamp-2 max-w-prose text-xs">
          {prompt}
        </p>
      ) : null}
    </div>
  );
}

function GenerateSvgRender({
  args,
  result,
  status,
}: {
  readonly args?: GenerateSvgArgs;
  readonly result?: GenerateSvgResult | string;
  readonly status: { readonly type: string };
}) {
  const running = status.type === "running";
  const parsed = parseResult(result);
  const path =
    (typeof parsed?.filePath === "string" && parsed.filePath.trim()) ||
    (typeof args?.filePath === "string" && args.filePath.trim()) ||
    "";
  const success = parsed?.success === true && path.length > 0;
  const error =
    typeof parsed?.error === "string" && parsed.error.trim()
      ? parsed.error.trim()
      : undefined;
  const prompt = parsed?.prompt || args?.prompt;
  const name = path ? fileBasename(path) : "mark.svg";

  if (success) {
    return (
      <div data-slot="generate-svg-tool" className="flex w-full flex-col gap-1">
        <WorkspaceSvgPreview path={path} label={name} />
        <p className={cn(mono, "text-foreground/40 text-xs")}>SVG</p>
      </div>
    );
  }

  if (running) {
    return (
      <GenerateSvgPlaceholder
        args={args}
        label="Generating SVG…"
        detail={truncatePrompt(prompt)}
      />
    );
  }

  return (
    <GenerateSvgPlaceholder
      args={args}
      label="SVG could not be generated"
      detail={error || "Generation failed."}
      failed
    />
  );
}

export const GenerateSvgToolUI = makeAssistantToolUI<
  GenerateSvgArgs,
  GenerateSvgResult | string
>({
  toolName: "generate_svg",
  display: "standalone",
  render: (props) => (
    <GenerateSvgRender
      args={props.args}
      result={props.result}
      status={props.status}
    />
  ),
});
