"use client";

import {
  createContext,
  memo,
  useContext,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import ReactMarkdown, { type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { markdownTextComponents } from "@/components/assistant-ui/elements/markdown-text";

// Standalone markdown renderer for content that lives outside a message part
// (the canvas document viewer). The docs for the markdown-text element are
// explicit: MarkdownText reads its text from the message-part context and has
// no props-driven form, so outside a part you render react-markdown directly
// with the same component mapping. The only overrides are pre/code: the chat
// renderer frames fenced code with a CodeHeader bar and detects blocks through
// MarkdownTextPrimitive's internal PreContext, which is not exported, so here
// pre carries its own rounded frame and a small context flag lets code tell
// blocks from inline spans.

const BlockCodeContext = createContext(false);

type MarkdownElementProps = ComponentPropsWithoutRef<"pre"> & ExtraProps;

const standalonePre = ({ children, className, ...props }: MarkdownElementProps) => (
  <BlockCodeContext.Provider value={true}>
    <pre
      className={cn(
        "aui-md-pre border-border/50 bg-muted/30 my-3 overflow-x-auto rounded-xl border p-3.5 text-[13px] leading-relaxed first:mt-0 last:mb-0",
        className,
      )}
    >
      {children}
    </pre>
  </BlockCodeContext.Provider>
);

type CodeElementProps = ComponentPropsWithoutRef<"code"> & ExtraProps;

const standaloneCode = ({
  className,
  children,
  ...props
}: CodeElementProps) => {
  const isBlock = useContext(BlockCodeContext);
  return (
    <code
      className={cn(
        !isBlock &&
          "aui-md-inline-code bg-muted rounded-md px-1.5 py-0.5 font-mono text-[0.85em]",
        className,
      )}
      {...props}
    >
      {children}
    </code>
  );
};

const standaloneComponents = {
  ...markdownTextComponents,
  pre: standalonePre,
  code: standaloneCode,
};

export const MarkdownContent = memo(function MarkdownContent({
  text,
  className,
}: {
  readonly text: string;
  readonly className?: string;
  readonly children?: ReactNode;
}) {
  return (
    <div className={cn("aui-md", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={standaloneComponents}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
