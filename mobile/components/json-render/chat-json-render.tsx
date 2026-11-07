import { memo, useMemo, type FC } from "react";
import { View } from "react-native";
import {
  ActionProvider,
  Renderer,
  StateProvider,
  VisibilityProvider,
} from "@json-render/react-native";
import type { Spec } from "@json-render/core";
import { useAui, useAuiState } from "@assistant-ui/react-native";
import { MarkdownText } from "@/components/assistant-ui/elements/markdown-text";
import { parseInlineSpec } from "../../../lib/json-render/inline-spec";
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
    <View className="my-1 max-w-full">
      <StateProvider initialState={spec.state ?? {}}>
        <VisibilityProvider>
          <ActionProvider handlers={handlers}>
            <Renderer
              spec={spec}
              registry={chatRegistry}
              includeStandard={false}
              loading={loading}
              fallback={() => null}
            />
          </ActionProvider>
        </VisibilityProvider>
      </StateProvider>
    </View>
  );
};

/**
 * Assistant text part that may embed an inline json-render spec.
 * Falls back to MarkdownText when there is no UI.
 */
export const AssistantInlineText: FC = memo(function AssistantInlineText() {
  const aui = useAui();
  const text = useAuiState((s) => {
    const part = s.part;
    return part.type === "text" && typeof part.text === "string"
      ? part.text
      : "";
  });
  const statusType = useAuiState((s) =>
    s.part.type === "text" ? s.part.status?.type : undefined,
  );
  const messageRunning = useAuiState(
    (s) =>
      s.message.role === "assistant" && s.message.status?.type === "running",
  );
  const running = messageRunning || statusType === "running";
  const textStatus = running
    ? ({ type: "running" } as const)
    : ({ type: "complete" } as const);

  const parsed = useMemo(
    () => parseInlineSpec(text, { complete: !running }),
    [text, running],
  );

  if (!parsed.hasSpec || !parsed.spec) {
    return <MarkdownText type="text" text={text} status={textStatus} />;
  }

  return (
    <View className="flex-col gap-3">
      {parsed.segments.map((segment, index) => {
        if (segment.type === "text") {
          if (!segment.text.trim()) return null;
          return (
            <MarkdownText
              key={`text-${index}`}
              type="text"
              text={segment.text}
              status={textStatus}
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
    </View>
  );
});
