"use client";

import { memo, useMemo, type FC } from "react";
import {
  ActionProvider,
  Renderer,
  StateProvider,
  VisibilityProvider,
} from "@json-render/react";
import type { Spec } from "@json-render/core";
import { useAui, useAuiState } from "@assistant-ui/react";
import {
  StreamingMarkdownBody,
  StreamingMarkdownText,
} from "@/components/assistant-ui/elements/streaming-markdown-text";
import { parseInlineSpec } from "@/lib/json-render/inline-spec";
import { chatRegistry } from "@/components/json-render/registry";

const SpecBlock: FC<{
  readonly spec: Spec;
  readonly loading: boolean;
  readonly onReply: (message: string) => void;
}> = ({ spec, loading, onReply }) => {
  const handlers = useMemo(
    () => ({
      reply: async (params: Record<string, unknown>) => {
        const message =
          typeof params.message === "string" ? params.message.trim() : "";
        if (message) onReply(message);
      },
    }),
    [onReply],
  );

  return (
    <div data-slot="aui_json-render" className="my-1 max-w-full">
      <StateProvider initialState={spec.state ?? {}}>
        <VisibilityProvider>
          <ActionProvider handlers={handlers}>
            <Renderer
              spec={spec}
              registry={chatRegistry}
              loading={loading}
              fallback={() => null}
            />
          </ActionProvider>
        </VisibilityProvider>
      </StateProvider>
    </div>
  );
};

/**
 * Assistant text part that may embed an inline json-render spec.
 * Falls back to paced StreamingMarkdown when there is no UI.
 */
export const AssistantInlineText: FC = memo(function AssistantInlineText() {
  const aui = useAui();
  const text = useAuiState((s) => {
    const part = s.part;
    return part.type === "text" ? (part.text ?? "") : "";
  });
  const partStreaming = useAuiState((s) => {
    const part = s.part;
    if (part.type !== "text") return false;
    return (part.status?.type ?? "complete") === "running";
  });
  const running = useAuiState(
    (s) =>
      s.message.role === "assistant" && s.message.status?.type === "running",
  );

  const parsed = useMemo(
    () => parseInlineSpec(text, { complete: !running }),
    [text, running],
  );

  if (!parsed.hasSpec || !parsed.spec) {
    return <StreamingMarkdownText />;
  }

  return (
    <div className="flex flex-col gap-3">
      {parsed.segments.map((segment, index) => {
        if (segment.type === "text") {
          if (!segment.text.trim()) return null;
          return (
            <StreamingMarkdownBody
              key={`text-${index}`}
              text={segment.text}
              streaming={partStreaming}
            />
          );
        }
        return (
          <SpecBlock
            key="spec"
            spec={parsed.spec!}
            loading={running}
            onReply={(message) => {
              aui.thread.append(message);
            }}
          />
        );
      })}
    </div>
  );
});
