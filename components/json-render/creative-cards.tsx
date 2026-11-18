"use client";

import {
  chartSeriesLayout,
  clampVisibleCount,
} from "@/lib/json-render/chart";
import { regionBarWidths } from "@/lib/json-render/diagrams";
import { httpsImageSrc, isHttpsPdfUrl } from "@/lib/json-render/pdf-url";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type SettingsRow = { readonly label: string; readonly value: string };
type SettingsGroup = {
  readonly name: string;
  readonly rows: readonly SettingsRow[];
};

function MetaLine({ children }: { readonly children: ReactNode }) {
  return <div className="text-muted-foreground text-[12px]">{children}</div>;
}

function SettingsGroups({ groups }: { readonly groups: readonly SettingsGroup[] }) {
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <div key={group.name} className="flex flex-col gap-1">
          <div className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">
            {group.name}
          </div>
          <div className="flex flex-col">
            {group.rows.map((row, index) => (
              <div
                key={`${group.name}-${row.label}`}
                className={cn(
                  "flex items-baseline justify-between gap-3 py-1.5 text-[13px]",
                  index > 0 && "border-border/60 border-t",
                )}
              >
                <span className="text-muted-foreground font-mono text-[11px]">
                  {row.label}
                </span>
                <span className="text-foreground text-right tabular-nums">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function aspectClass(aspect: string | null | undefined): string {
  if (aspect === "9:16") return "aspect-[9/16]";
  if (aspect === "1:1") return "aspect-square";
  return "aspect-video";
}

/** Web json-render components for creative / data / artifact answer cards. */
export const creativeWebCards = {
  PhotoEditSettings: ({
    props,
  }: {
    props: {
      title: string | null;
      image: string | null;
      groups: SettingsGroup[];
    };
  }) => {
    const image = httpsImageSrc(props.image);
    return (
      <div className="flex flex-col gap-3" data-slot="photo-edit-settings">
        {props.title ? (
          <div className="text-foreground text-[15px] font-medium">{props.title}</div>
        ) : null}
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- generative https thumbs
          <img
            src={image}
            alt={props.title ?? "Photo preview"}
            className="border-border/50 h-40 w-full rounded-lg border object-cover"
          />
        ) : null}
        <SettingsGroups groups={props.groups} />
      </div>
    );
  },

  MusicProdSettings: ({
    props,
  }: {
    props: {
      title: string | null;
      project: string | null;
      bpm: string | null;
      key: string | null;
      tracks: {
        name: string;
        role: string | null;
        level: string | null;
        muted: boolean | null;
      }[] | null;
      groups: SettingsGroup[] | null;
    };
  }) => {
    const meta = [props.project, props.bpm ? `${props.bpm} BPM` : null, props.key]
      .filter(Boolean)
      .join(" · ");
    const tracks = props.tracks ?? [];
    return (
      <div className="flex flex-col gap-3" data-slot="music-prod-settings">
        <div className="flex flex-col gap-0.5">
          {props.title ? (
            <div className="text-foreground text-[15px] font-medium">{props.title}</div>
          ) : null}
          {meta ? <MetaLine>{meta}</MetaLine> : null}
        </div>
        {tracks.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <div className="text-muted-foreground font-mono text-[11px] uppercase tracking-wide">
              Tracks
            </div>
            {tracks.map((track) => (
              <div
                key={track.name}
                className={cn(
                  "flex items-baseline justify-between gap-2 rounded-lg border px-2.5 py-2",
                  track.muted ? "border-border/40 opacity-60" : "border-border/50",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-foreground text-[13.5px] font-medium">
                    {track.name}
                    {track.muted ? " · muted" : ""}
                  </div>
                  {track.role ? <MetaLine>{track.role}</MetaLine> : null}
                </div>
                {track.level ? (
                  <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
                    {track.level}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {props.groups && props.groups.length > 0 ? (
          <SettingsGroups groups={props.groups} />
        ) : null}
      </div>
    );
  },

  VideoStoryboard: ({
    props,
  }: {
    props: {
      title: string | null;
      aspect: "16:9" | "9:16" | "1:1" | null;
      frames: {
        label: string | null;
        image: string | null;
        beat: string | null;
        duration: string | null;
      }[];
    };
  }) => {
    const frameClass = aspectClass(props.aspect);
    return (
      <div className="flex flex-col gap-2" data-slot="video-storyboard">
        {props.title ? (
          <div className="text-foreground text-[15px] font-medium">{props.title}</div>
        ) : null}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {props.frames.map((frame, index) => {
            const image = httpsImageSrc(frame.image);
            const caption = [frame.beat, frame.duration].filter(Boolean).join(" · ");
            return (
              <div key={index} className="flex w-36 shrink-0 flex-col gap-1">
                <div
                  className={cn(
                    "border-border/50 bg-muted/40 relative w-full overflow-hidden rounded-lg border",
                    frameClass,
                  )}
                >
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt={frame.label ?? `Frame ${index + 1}`}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-muted-foreground absolute inset-0 flex items-center justify-center text-[11px]">
                      Frame {index + 1}
                    </div>
                  )}
                </div>
                {frame.label ? (
                  <div className="text-foreground truncate text-[12px] font-medium">
                    {frame.label}
                  </div>
                ) : null}
                {caption ? <MetaLine>{caption}</MetaLine> : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  },

  IndicatorCard: ({
    props,
  }: {
    props: {
      title: string;
      source: string | null;
      unit: string | null;
      value: string | null;
      delta: string | null;
      asOf: string | null;
      points: number[] | null;
      regions: { label: string; value: number; hint: string | null }[] | null;
      rows: { label: string; value: string }[] | null;
    };
  }) => {
    const points = props.points ?? [];
    const regions = props.regions ?? [];
    const rows = props.rows ?? [];
    const layout =
      points.length > 0
        ? chartSeriesLayout(points, clampVisibleCount(points.length, null))
        : null;
    const widths =
      regions.length > 0
        ? regionBarWidths(regions.map((region) => region.value))
        : [];
    const unit = props.unit ?? "";
    const meta = [props.source, props.asOf].filter(Boolean).join(" · ");
    return (
      <div className="flex flex-col gap-3" data-slot="indicator-card">
        <div className="flex flex-col gap-0.5">
          <div className="text-foreground text-[15px] font-medium">{props.title}</div>
          {meta ? <MetaLine>{meta}</MetaLine> : null}
        </div>
        {(props.value || props.delta) && (
          <div className="flex items-baseline justify-between gap-2">
            {props.value ? (
              <div className="text-foreground text-2xl font-semibold tracking-tight tabular-nums">
                {props.value}
                {unit ? (
                  <span className="text-muted-foreground ml-1 text-[13px] font-normal">
                    {unit}
                  </span>
                ) : null}
              </div>
            ) : (
              <span />
            )}
            {props.delta ? (
              <span className="text-muted-foreground font-mono text-[11px]">
                {props.delta}
              </span>
            ) : null}
          </div>
        )}
        {layout && layout.linePath ? (
          <svg viewBox="0 0 240 72" className="text-foreground h-16 w-full" aria-hidden>
            {layout.areaPath ? (
              <path d={layout.areaPath} className="fill-blue-500/20" />
            ) : null}
            <path
              d={layout.linePath}
              fill="none"
              strokeWidth={2}
              className="stroke-blue-500"
            />
            {layout.visible.length > 0 ? (
              <circle
                cx={layout.visible[layout.visible.length - 1]!.x}
                cy={layout.visible[layout.visible.length - 1]!.y}
                r={3}
                className="fill-blue-500"
              />
            ) : null}
          </svg>
        ) : null}
        {regions.length > 0 ? (
          <div className="flex flex-col gap-2">
            {regions.map((region, index) => (
              <div key={region.label} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="text-foreground font-medium">{region.label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {region.value}
                    {unit}
                    {region.hint ? ` · ${region.hint}` : ""}
                  </span>
                </div>
                <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-foreground/70 h-full rounded-full"
                    style={{ width: `${widths[index] ?? 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {rows.length > 0 ? (
          <div className="flex flex-col">
            {rows.map((row, index) => (
              <div
                key={row.label}
                className={cn(
                  "flex items-baseline justify-between gap-3 py-1.5 text-[13px]",
                  index > 0 && "border-border/60 border-t",
                )}
              >
                <span className="text-muted-foreground">{row.label}</span>
                <span className="text-foreground tabular-nums">{row.value}</span>
              </div>
            ))}
          </div>
        ) : null}
        {points.length === 0 && regions.length === 0 && rows.length === 0 ? (
          <MetaLine>No series or breakdown yet.</MetaLine>
        ) : null}
      </div>
    );
  },

  Slides: ({
    props,
  }: {
    props: {
      title: string | null;
      theme: string | null;
      slides: {
        title: string;
        bullets: string[] | null;
        image: string | null;
        notes: string | null;
      }[];
      index: number | null;
    };
  }) => {
    const count = props.slides.length;
    const rawIndex =
      props.index == null || !Number.isFinite(props.index)
        ? 0
        : Math.floor(props.index);
    const currentIndex = Math.max(0, Math.min(count - 1, rawIndex));
    const current = props.slides[currentIndex]!;
    const image = httpsImageSrc(current.image);
    const bullets = current.bullets ?? [];
    return (
      <div className="flex flex-col gap-3" data-slot="slides">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            {props.title ? (
              <div className="text-foreground text-[15px] font-medium">
                {props.title}
              </div>
            ) : null}
            {props.theme ? <MetaLine>{props.theme}</MetaLine> : null}
          </div>
          <MetaLine>
            {currentIndex + 1} / {count}
          </MetaLine>
        </div>
        <div className="border-border/50 bg-muted/20 flex flex-col gap-3 rounded-lg border p-3">
          <div className="text-foreground text-[16px] font-medium leading-snug">
            {current.title}
          </div>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={current.title}
              className="border-border/40 h-32 w-full rounded-md border object-cover"
            />
          ) : null}
          {bullets.length > 0 ? (
            <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-4 text-[13.5px] leading-relaxed">
              {bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
          {current.notes ? (
            <MetaLine>Notes: {current.notes}</MetaLine>
          ) : null}
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {props.slides.map((slide, index) => (
            <div
              key={`${slide.title}-${index}`}
              className={cn(
                "min-w-[4.5rem] rounded-md border px-2 py-1.5 text-[11px]",
                index === currentIndex
                  ? "border-foreground/40 bg-muted/60 text-foreground font-medium"
                  : "border-border/50 text-muted-foreground",
              )}
            >
              {index + 1}. {slide.title}
            </div>
          ))}
        </div>
      </div>
    );
  },

  PdfArtifact: ({
    props,
  }: {
    props: {
      title: string;
      src: string | null;
      pages: string | null;
      size: string | null;
      updated: string | null;
    };
  }) => {
    const embed = isHttpsPdfUrl(props.src);
    const meta = [props.pages, props.size, props.updated]
      .filter(Boolean)
      .join(" · ");
    return (
      <div className="flex flex-col gap-2" data-slot="pdf-artifact">
        <div className="flex flex-col gap-0.5">
          <div className="text-foreground text-[15px] font-medium">{props.title}</div>
          {meta ? <MetaLine>{meta}</MetaLine> : null}
        </div>
        {embed && props.src ? (
          <>
            <iframe
              title={props.title}
              src={props.src}
              className="border-border/50 bg-muted/20 h-64 w-full rounded-lg border"
            />
            <a
              href={props.src}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground text-[12px] underline-offset-2 hover:underline"
            >
              Open PDF
            </a>
          </>
        ) : (
          <div className="border-border/50 bg-muted/30 flex flex-col items-start gap-1 rounded-lg border px-3 py-4">
            <div className="text-foreground text-[13px] font-medium">PDF artifact</div>
            <MetaLine>
              {props.src
                ? "Needs an https PDF URL to embed."
                : "No file URL yet — receipt only."}
            </MetaLine>
          </div>
        )}
      </div>
    );
  },
};
