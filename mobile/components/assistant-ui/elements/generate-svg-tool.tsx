import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { ImageIcon, ImageOffIcon } from "lucide-react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { WorkspaceSvgPreview } from "@/components/assistant-ui/elements/workspace-svg-preview";
import { fileBasename } from "../../../../lib/design/file-preview";
import { cn } from "@/lib/utils";

type GenerateSvgArgs = {
  readonly prompt?: string;
  readonly filePath?: string;
};

type GenerateSvgResult = {
  readonly success?: boolean;
  readonly error?: string;
  readonly filePath?: string;
  readonly prompt?: string;
};

function truncatePrompt(prompt: string | undefined, max = 120): string {
  const trimmed = prompt?.trim() ?? "";
  if (!trimmed) return "";
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function parseResult(result: unknown): GenerateSvgResult | undefined {
  if (!result) return undefined;
  if (typeof result === "object" && !Array.isArray(result)) {
    return result as GenerateSvgResult;
  }
  if (typeof result === "string") {
    try {
      const parsed = JSON.parse(result) as GenerateSvgResult;
      return parsed && typeof parsed === "object" ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
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
    <View
      className={cn(
        "border-border/50 bg-card w-full max-w-sm items-center justify-center gap-2 rounded-2xl border p-6",
        !failed && "opacity-90",
      )}
      accessibilityRole={failed ? undefined : "summary"}
      accessibilityLabel={label}
    >
      <Icon
        as={failed ? ImageOffIcon : ImageIcon}
        className="text-muted-foreground size-8"
      />
      <Text variant="secondary" weight="medium" className="text-center">
        {label}
      </Text>
      {detail || prompt ? (
        <Text
          variant="caption"
          tone="muted"
          className="text-center"
          numberOfLines={3}
        >
          {detail || prompt}
        </Text>
      ) : null}
      {!failed ? <ActivityIndicator /> : null}
    </View>
  );
}

export function GenerateSvgToolCard({
  args,
  result,
  status,
}: {
  readonly args?: GenerateSvgArgs;
  readonly result?: unknown;
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
  const [settledPath, setSettledPath] = useState(path);

  useEffect(() => {
    if (path) setSettledPath(path);
  }, [path]);

  if (success || (settledPath && parsed?.success === true)) {
    const openPath = path || settledPath;
    return (
      <View className="w-full gap-1">
        <WorkspaceSvgPreview
          path={openPath}
          label={fileBasename(openPath)}
        />
        <Text variant="caption" tone="muted">
          SVG
        </Text>
      </View>
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
