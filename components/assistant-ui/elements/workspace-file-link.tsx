"use client";

import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { useCanvas } from "@/components/assistant-ui/elements/canvas-context";
import { chatFileUrl } from "@/lib/design/chat-file-url";
import { fileBasename } from "@/lib/design/file-preview";
import { cn } from "@/lib/utils";

/**
 * Workspace file control that left-clicks into the side panel and right-clicks
 * to the browser Save menu via a real download URL.
 */
export function WorkspaceFileLink({
  path,
  content,
  className,
  children,
  onOpen,
  ...props
}: Omit<ComponentProps<"a">, "href" | "download" | "onClick" | "children"> & {
  readonly path: string;
  readonly content?: string;
  readonly children?: ReactNode;
  readonly onOpen?: (path: string, content?: string) => void;
}) {
  const canvas = useCanvas();
  const chatId = canvas.chatId;
  const openPath = onOpen ?? canvas.openPath;
  const name = fileBasename(path);
  const href = chatId
    ? chatFileUrl({ chatId, path, download: true })
    : undefined;

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    openPath(path, content);
  };

  if (!href) {
    return (
      <button
        type="button"
        title={`Open ${path}`}
        onClick={() => openPath(path, content)}
        className={cn(className)}
        {...(props as ComponentProps<"button">)}
      >
        {children}
      </button>
    );
  }

  return (
    <a
      href={href}
      download={name}
      title={`Open ${path}`}
      onClick={handleClick}
      className={cn(className)}
      {...props}
    >
      {children}
    </a>
  );
}
