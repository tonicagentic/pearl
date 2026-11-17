import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { ImageIcon, ImageOffIcon } from "lucide-react-native";
import { View } from "react-native";

import {
  ImageContentFilterError,
  ImageFilename,
  ImagePreview,
  ImageRoot,
  ImageZoom,
} from "@/components/assistant-ui/elements/image";

type GenerateImageArgs = {
  readonly prompt?: string;
  readonly size?: string;
  readonly aspectRatio?: string;
};

type GenerateImageResult = {
  readonly success?: boolean;
  readonly error?: string;
  readonly url?: string;
  readonly pathname?: string;
  readonly prompt?: string;
};

export function parseGenerateImageAspectRatio(
  args?: GenerateImageArgs,
): number {
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
  result: unknown,
): GenerateImageResult | undefined {
  if (!result) return undefined;
  if (typeof result === "object" && !Array.isArray(result)) {
    return result as GenerateImageResult;
  }
  if (typeof result === "string") {
    try {
      const parsed = JSON.parse(result) as GenerateImageResult;
      return parsed && typeof parsed === "object" ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
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
  const ratio = parseGenerateImageAspectRatio(args);
  const prompt = truncatePrompt(args?.prompt);

  return (
    <ImageRoot className="w-full max-w-[512px]">
      <View
        accessibilityLabel={label}
        accessibilityRole={failed ? undefined : "progressbar"}
        className={cn(
          "bg-muted/50 w-full items-center justify-center gap-2 overflow-hidden p-4",
        )}
        style={{ aspectRatio: ratio }}
      >
        <Icon
          as={failed ? ImageOffIcon : ImageIcon}
          className="text-muted-foreground size-8"
        />
        <Text className="text-foreground text-center text-sm font-medium">
          {label}
        </Text>
        {detail || prompt ? (
          <Text
            className="text-muted-foreground text-center text-xs"
            numberOfLines={detail ? 3 : 2}
          >
            {detail || prompt}
          </Text>
        ) : null}
      </View>
    </ImageRoot>
  );
}

export function GenerateImageToolCard({
  args,
  result,
  status,
}: {
  readonly args?: GenerateImageArgs;
  readonly result?: unknown;
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
    parsed?.pathname?.split("/").pop() || "generated-image.png";
  const prompt = parsed?.prompt || args?.prompt;

  if (running) {
    return (
      <GenerateImagePlaceholder
        args={args}
        label="Generating image…"
        detail={truncatePrompt(prompt)}
      />
    );
  }

  if (success) {
    return (
      <ImageRoot className="w-full max-w-[512px]">
        <ImageZoom src={url} alt={prompt || filename}>
          <ImagePreview src={url} alt={prompt || filename} />
        </ImageZoom>
        <ImageFilename>{filename}</ImageFilename>
      </ImageRoot>
    );
  }

  if (error && /content.?filter|moderation|safety|blocked/i.test(error)) {
    return (
      <ImageRoot className="w-full max-w-[512px]">
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
