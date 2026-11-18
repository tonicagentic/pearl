"use client";

import { makeAssistantToolUI } from "@assistant-ui/react";
import { ImageIcon, ImageOffIcon } from "lucide-react";

import {
  ImageActions,
  ImageContentFilterError,
  ImageFilename,
  ImagePreview,
  ImageRoot,
  ImageZoom,
} from "@/components/assistant-ui/elements/image";
import { cn } from "@/lib/utils";

type GenerateImageArgs = {
  readonly prompt?: string;
  readonly size?: string;
  readonly aspectRatio?: string;
  readonly seed?: number;
  readonly pathname?: string;
};

type GenerateImageResult = {
  readonly success?: boolean;
  readonly error?: string;
  readonly url?: string;
  readonly downloadUrl?: string;
  readonly pathname?: string;
  readonly filePath?: string;
  readonly contentType?: string;
  readonly model?: string;
  readonly prompt?: string;
  readonly width?: number;
  readonly height?: number;
};

function parseAspectRatio(args?: GenerateImageArgs): number {
  const size = args?.size?.trim();
  if (size) {
    const match = /^(\d+)x(\d+)$/.exec(size);
    if (match) {
      const width = Number(match[1]);
      const height = Number(match[2]);
      if (width > 0 && height > 0) return width / height;
    }
  }
  const aspect = args?.aspectRatio?.trim();
  if (aspect) {
    const match = /^(\d+):(\d+)$/.exec(aspect);
    if (match) {
      const width = Number(match[1]);
      const height = Number(match[2]);
      if (width > 0 && height > 0) return width / height;
    }
  }
  return 1;
}

function truncatePrompt(prompt: string | undefined, max = 120): string {
  const trimmed = prompt?.trim() ?? "";
  if (!trimmed) return "";
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function parseResult(
  result: GenerateImageResult | string | undefined,
): GenerateImageResult | undefined {
  if (!result) return undefined;
  if (typeof result === "object") return result;
  try {
    const parsed = JSON.parse(result) as GenerateImageResult;
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function GenerateImagePlaceholder({
  args,
  label,
  detail,
  failed,
}: {
  readonly args?: GenerateImageArgs;
  readonly label: string;
  readonly detail?: string;
  readonly failed?: boolean;
}) {
  const ratio = parseAspectRatio(args);
  const prompt = truncatePrompt(args?.prompt);

  return (
    <ImageRoot size="lg" className="w-full max-w-[512px]">
      <div
        data-slot="generate-image-placeholder"
        className={cn(
          "bg-muted/50 relative flex w-full flex-col items-center justify-center gap-2 overflow-hidden p-4 text-center",
          !failed && "animate-pulse motion-reduce:animate-none",
        )}
        style={{ aspectRatio: String(ratio) }}
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
    </ImageRoot>
  );
}

function GenerateImageRender({
  args,
  result,
  status,
}: {
  readonly args?: GenerateImageArgs;
  readonly result?: GenerateImageResult | string;
  readonly status: { readonly type: string };
}) {
  const running = status.type === "running";
  const parsed = parseResult(result);
  const url = parsed?.url?.trim() || "";
  const success = parsed?.success === true && url.length > 0;
  const error =
    typeof parsed?.error === "string" && parsed.error.trim()
      ? parsed.error.trim()
      : undefined;
  const filename =
    parsed?.filePath?.split("/").pop() ||
    parsed?.pathname?.split("/").pop() ||
    args?.pathname?.split("/").pop() ||
    "generated-image.png";
  const prompt = parsed?.prompt || args?.prompt;

  // Prefer a settled URL over turn-level "running" — otherwise the preview
  // flashes away while assistant text streams (tool part stays preliminary).
  if (success) {
    const part = { type: "image" as const, image: url, filename };
    return (
      <div
        data-slot="generate-image-tool"
        className="flex w-full max-w-[512px] flex-col gap-1"
      >
        <ImageRoot size="lg" className="w-full max-w-[512px]">
          <ImageZoom src={url} alt={prompt || filename}>
            <ImagePreview src={url} alt={prompt || filename} />
          </ImageZoom>
          <div className="flex items-center justify-between gap-2">
            <ImageFilename className="min-w-0 flex-1">
              {filename}
            </ImageFilename>
            <ImageActions part={part} />
          </div>
        </ImageRoot>
      </div>
    );
  }

  if (running) {
    return (
      <GenerateImagePlaceholder
        args={args}
        label="Generating image…"
        detail={truncatePrompt(prompt)}
      />
    );
  }

  if (error && /content.?filter|moderation|safety|blocked/i.test(error)) {
    return (
      <ImageRoot size="lg" className="w-full max-w-[512px]">
        <ImageContentFilterError reason={error} />
      </ImageRoot>
    );
  }

  return (
    <GenerateImagePlaceholder
      args={args}
      label="Image could not be generated"
      detail={error || "Generation failed."}
      failed
    />
  );
}

export const GenerateImageToolUI = makeAssistantToolUI<
  GenerateImageArgs,
  GenerateImageResult | string
>({
  toolName: "generate_image",
  // Standalone so the frame mounts as soon as the call starts instead of
  // collapsing into the session timeline.
  display: "standalone",
  render: (props) => (
    <GenerateImageRender
      args={props.args}
      result={props.result}
      status={props.status}
    />
  ),
});
