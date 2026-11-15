"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  buildCoderFileTree,
  type CoderHandoff,
  type CoderJobProgress,
} from "@/lib/chat/coder-receipt";
import { FileTree } from "./file-tree";
import { JobProgress } from "./job-progress";
import { LinkPreview } from "./link-preview";
import { VideoPlayer } from "./media-player";
import { WebPreview } from "./web-preview";

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
        onOpenExternal={() =>
          window.open(url, "_blank", "noopener,noreferrer")
        }
      >
        {screenshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={screenshotUrl}
            alt="Preview screenshot"
            className="h-56 w-full object-cover object-top"
          />
        ) : (
          <div className="text-foreground/55 flex h-56 items-center justify-center px-4 text-center text-xs">
            Preview requires sign-in. Open it in a new tab.
          </div>
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
      onOpenExternal={() => window.open(url, "_blank", "noopener,noreferrer")}
    >
      <iframe
        key={key}
        src={url}
        title="Preview"
        sandbox="allow-scripts allow-forms allow-popups"
        className="h-56 w-full border-0"
        onLoad={() => setLoading(false)}
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
      className={cn("border-0 bg-transparent p-0 shadow-none", className)}
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

  return (
    <div className={cn("flex w-full flex-col gap-2.5", className)}>
      {handoff.summary ? (
        <p className="text-foreground/75 text-xs leading-relaxed">
          {handoff.summary}
        </p>
      ) : null}

      {tree ? (
        <FileTree
          nodes={tree.nodes}
          visibleCount={tree.nodes.length}
          totalAdditions={tree.totalAdditions}
          totalDeletions={tree.totalDeletions}
          className="max-w-none"
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
          className="max-w-none"
        />
      ) : null}

      {handoff.pullRequest ? (
        <LinkPreview
          href={handoff.pullRequest.url}
          title={`#${handoff.pullRequest.number} ${handoff.pullRequest.title}`}
          description={
            handoff.pullRequest.draft === false ? "Pull request" : "Draft pull request"
          }
          siteName="GitHub"
          layout="compact"
          className="max-w-none"
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
          className="max-w-none"
        />
      ) : null}
    </div>
  );
}
