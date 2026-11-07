"use client";

import { useEffect, useRef } from "react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import { GlobeIcon, LoaderIcon } from "lucide-react";

import { useCanvas } from "@/components/assistant-ui/elements/canvas-context";
import { cn } from "@/lib/utils";
import type { BrowserActionResult } from "@/lib/browser/types";

type BrowserArgs = {
  readonly action?: string;
  readonly url?: string;
};

function BrowserToolRender({
  args,
  result,
  status,
}: {
  readonly args?: BrowserArgs;
  readonly result?: BrowserActionResult | string;
  readonly status: { readonly type: string };
}) {
  const {
    chatId,
    syncBrowserPages,
    setControlMode,
    setViewUrl,
    viewUrl,
  } = useCanvas();
  const fetchedView = useRef(false);
  const running = status.type === "running";
  const parsed =
    result && typeof result === "object" ? result : undefined;

  useEffect(() => {
    if (!parsed?.tabs?.length) return;
    syncBrowserPages(parsed.tabs);
    if (parsed.controlMode) setControlMode(parsed.controlMode);
  }, [parsed, syncBrowserPages, setControlMode]);

  useEffect(() => {
    if (!chatId || fetchedView.current || viewUrl) return;
    if (!parsed?.ok && !running) return;
    fetchedView.current = true;
    void (async () => {
      try {
        const res = await fetch(`/api/chats/${chatId}/browser`);
        if (!res.ok) {
          fetchedView.current = false;
          return;
        }
        const data = (await res.json()) as { viewUrl?: string };
        if (data.viewUrl) setViewUrl(data.viewUrl);
      } catch {
        fetchedView.current = false;
      }
    })();
  }, [chatId, parsed?.ok, running, setViewUrl, viewUrl]);

  const label =
    args?.action === "navigate" && args.url
      ? `Browse ${args.url}`
      : args?.action
        ? `Browser · ${args.action}`
        : "Browser";

  return (
    <div
      className={cn(
        "border-foreground/[0.08] text-foreground/70 flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-[13px]",
      )}
      data-slot="browser-tool"
    >
      {running ? (
        <LoaderIcon className="size-3.5 shrink-0 animate-spin opacity-60" />
      ) : (
        <GlobeIcon className="size-3.5 shrink-0 opacity-60" />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {parsed?.title || parsed?.url ? (
        <span className="text-foreground/40 max-w-[40%] truncate text-[12px]">
          {parsed.title || parsed.url}
        </span>
      ) : null}
    </div>
  );
}

export const BrowserToolUI = makeAssistantToolUI<
  BrowserArgs,
  BrowserActionResult | string
>({
  toolName: "browser",
  render: (props) => (
    <BrowserToolRender
      args={props.args}
      result={props.result}
      status={props.status}
    />
  ),
});
