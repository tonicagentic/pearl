import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { mono, paper } from "./surfaces";

type ExpoVideo = typeof import("expo-video");

let expoVideo: ExpoVideo | null | undefined;

function getExpoVideo(): ExpoVideo | null {
  if (expoVideo !== undefined) return expoVideo;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expoVideo = require("expo-video") as ExpoVideo;
  } catch {
    expoVideo = null;
  }
  return expoVideo;
}

function ExpoVideoPlayer({
  src,
  title,
  durationMs,
  className,
}: {
  readonly src: string;
  readonly title?: string;
  readonly durationMs?: number;
  readonly className?: string;
}) {
  const mod = getExpoVideo()!;
  const player = mod.useVideoPlayer(src, (p) => {
    p.loop = false;
    p.muted = true;
  });

  return (
    <View className={cn(paper, "w-full overflow-hidden rounded-2xl", className)}>
      <View className="aspect-video w-full bg-foreground/5">
        <mod.VideoView
          player={player}
          style={{ width: "100%", height: "100%" }}
          contentFit="contain"
          nativeControls
        />
      </View>
      {(title || durationMs !== undefined) && (
        <View className="flex-row items-center gap-2 px-3.5 py-2">
          {title ? (
            <Text variant="secondary" tone="default" numberOfLines={1} className="min-w-0 flex-1">
              {title}
            </Text>
          ) : null}
          {durationMs !== undefined ? (
            <Text variant="caption" tone="default" className={cn(mono, "opacity-40")}>
              {Math.max(1, Math.round(durationMs / 1000))}s
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

export function VideoPlayer({
  src,
  poster: _poster,
  title,
  durationMs,
  className,
}: {
  readonly src: string;
  readonly poster?: string;
  readonly title?: string;
  readonly durationMs?: number;
  readonly className?: string;
}) {
  if (!getExpoVideo()) {
    return (
      <View className={cn(paper, "w-full rounded-2xl p-3.5", className)}>
        <Text variant="caption" tone="default" className="opacity-55">
          {title ?? "Recording"} — video playback needs expo-video on this build.
        </Text>
      </View>
    );
  }

  return (
    <ExpoVideoPlayer
      src={src}
      title={title}
      durationMs={durationMs}
      className={className}
    />
  );
}
