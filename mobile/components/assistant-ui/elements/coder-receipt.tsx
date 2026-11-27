import { useEffect, useMemo, useState } from "react";
import { Image, View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import {
  buildCoderFileTree,
  type CoderHandoff,
  type CoderJobProgress,
} from "../../../../lib/chat/coder-receipt";
import { FileTree } from "./file-tree";
import { JobProgress } from "./job-progress";
import { LinkPreview } from "./link-preview";
import { VideoPlayer } from "./media-player";
import {
  openPreviewExternal,
  PreviewWebFrame,
  WebPreview,
} from "./web-preview";

function PreviewFrame({
  url,
  authWall,
  screenshotUrl,
}: {
  readonly url: string;
  readonly authWall?: boolean;
  readonly screenshotUrl?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);
  let origin = url;
  try {
    origin = new URL(url).host;
  } catch {
    // keep raw
  }

  useEffect(() => {
    setLoading(true);
    setKey((k) => k + 1);
  }, [url]);

  if (authWall) {
    return (
      <WebPreview
        origin={origin}
        loading={false}
        onOpenExternal={() => openPreviewExternal(url)}
      >
        {screenshotUrl ? (
          <Image
            source={{ uri: screenshotUrl }}
            className="h-56 w-full"
            resizeMode="cover"
          />
        ) : (
          <View className="h-56 items-center justify-center px-4">
            <Text variant="caption" tone="default" className="text-center opacity-55">
              Preview requires sign-in. Open it externally.
            </Text>
          </View>
        )}
      </WebPreview>
    );
  }

  return (
    <WebPreview
      origin={origin}
      loading={loading}
      onReload={() => {
        setLoading(true);
        setKey((k) => k + 1);
      }}
      onOpenExternal={() => openPreviewExternal(url)}
    >
      <PreviewWebFrame
        key={key}
        url={url}
        onLoadEnd={() => setLoading(false)}
      />
    </WebPreview>
  );
}

export function CoderWorkingReceipt({
  title,
  progress,
  className,
}: {
  readonly title: string;
  readonly progress: CoderJobProgress;
  readonly className?: string;
}) {
  return (
    <JobProgress
      title={title}
      stages={progress.stages}
      stageIndex={progress.stageIndex}
      stageProgress={progress.stageProgress}
      eta="working"
      className={cn("border-0 bg-transparent p-0", className)}
    />
  );
}

export function CoderSettledReceipt({
  handoff,
  className,
}: {
  readonly handoff: CoderHandoff;
  readonly className?: string;
}) {
  const tree = useMemo(
    () => (handoff.files?.length ? buildCoderFileTree(handoff.files) : null),
    [handoff.files],
  );

  // Nested inside the task card — strip paper so repo/PR/files are rows.
  const embedded =
    "rounded-none border-0 bg-transparent p-0 shadow-none dark:bg-transparent";

  return (
    <View className={cn("w-full flex-col gap-2.5", className)}>
      {handoff.summary ? (
        <Text
          variant="caption"
          tone="default"
          numberOfLines={2}
          className="leading-relaxed opacity-75"
        >
          {handoff.summary}
        </Text>
      ) : null}

      {tree ? (
        <FileTree
          nodes={tree.nodes}
          visibleCount={tree.nodes.length}
          totalAdditions={tree.totalAdditions}
          totalDeletions={tree.totalDeletions}
          className={embedded}
        />
      ) : null}

      {handoff.repo ? (
        <LinkPreview
          href={handoff.repo.url}
          title={`${handoff.repo.owner}/${handoff.repo.name}`}
          description={
            handoff.repo.branch ? `Branch ${handoff.repo.branch}` : undefined
          }
          siteName="GitHub"
          layout="compact"
          className={embedded}
        />
      ) : null}

      {handoff.pullRequest ? (
        <LinkPreview
          href={handoff.pullRequest.url}
          title={`#${handoff.pullRequest.number} ${handoff.pullRequest.title}`}
          description={
            handoff.pullRequest.draft === false
              ? "Pull request"
              : "Draft pull request"
          }
          siteName="GitHub"
          layout="compact"
          className={embedded}
        />
      ) : null}

      {handoff.preview ? (
        <PreviewFrame
          url={handoff.preview.url}
          authWall={handoff.preview.authWall}
          screenshotUrl={handoff.preview.screenshotUrl}
        />
      ) : null}

      {handoff.recording?.url ? (
        <VideoPlayer
          src={handoff.recording.url}
          poster={
            handoff.recording.posterUrl ?? handoff.preview?.screenshotUrl
          }
          title={handoff.recording.title ?? "Preview recording"}
          durationMs={handoff.recording.durationMs}
        />
      ) : null}
    </View>
  );
}
