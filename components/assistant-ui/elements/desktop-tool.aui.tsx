"use client";

import { useEffect, useRef } from "react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import { LoaderIcon, MonitorIcon } from "lucide-react";

import { useCanvas } from "@/components/assistant-ui/elements/canvas-context";
import { cn } from "@/lib/utils";
import type { DesktopActionResult } from "@/lib/desktop/types";

type DesktopArgs = {
  readonly action?: string;
};

function DesktopToolRender({
  args,
  result,
  status,
}: {
  readonly args?: DesktopArgs;
  readonly result?: DesktopActionResult | string;
  readonly status: { readonly type: string };
}) {
  const {
    chatId,
    openDesktop,
    setDesktopViewUrl,
    desktopViewUrl,
  } = useCanvas();
  const fetchedView = useRef(false);
  const running = status.type === "running";
  const parsed =
    result && typeof result === "object" ? result : undefined;
  const shouldOpen =
    args?.action === "start" ||
    (parsed?.ready === true && args?.action !== "stop");

  useEffect(() => {
    if (!shouldOpen) return;
    openDesktop("Desktop");
  }, [shouldOpen, openDesktop]);

  useEffect(() => {
    if (!chatId || fetchedView.current || desktopViewUrl) return;
    if (!shouldOpen && !running) return;
    if (args?.action === "stop") return;
    fetchedView.current = true;
    void (async () => {
      try {
        const res = await fetch(`/api/chats/${chatId}/desktop`);
        if (!res.ok) {
          fetchedView.current = false;
          return;
        }
        const data = (await res.json()) as { viewUrl?: string };
        if (data.viewUrl) setDesktopViewUrl(data.viewUrl);
      } catch {
        fetchedView.current = false;
      }
    })();
  }, [
    chatId,
    shouldOpen,
    running,
    args?.action,
    setDesktopViewUrl,
    desktopViewUrl,
  ]);

  useEffect(() => {
    if (args?.action === "stop" && parsed?.ok) {
      setDesktopViewUrl(null);
      fetchedView.current = false;
    }
  }, [args?.action, parsed?.ok, setDesktopViewUrl]);

  const label =
    args?.action === "start"
      ? "Desktop · start"
      : args?.action
        ? `Desktop · ${args.action}`
        : "Desktop";

  return (
    <div
      className={cn(
        "border-foreground/[0.08] text-foreground/70 flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-[13px]",
      )}
      data-slot="desktop-tool"
    >
      {running ? (
        <LoaderIcon className="size-3.5 shrink-0 animate-spin opacity-60" />
      ) : (
        <MonitorIcon className="size-3.5 shrink-0 opacity-60" />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {parsed?.ready ? (
        <span className="text-foreground/40 text-[12px]">streaming</span>
      ) : null}
    </div>
  );
}

export const DesktopToolUI = makeAssistantToolUI<
  DesktopArgs,
  DesktopActionResult | string
>({
  toolName: "desktop",
  render: (props) => (
    <DesktopToolRender
      args={props.args}
      result={props.result}
      status={props.status}
    />
  ),
});
