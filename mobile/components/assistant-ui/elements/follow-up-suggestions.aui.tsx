import { ThreadPrimitive, useAuiState, AuiIf } from "@assistant-ui/react-native";
import { ScrollView, Text } from "react-native";

// RN port of the web follow-up-suggestions element: suggestion chips shown
// after a response completes, in a horizontal scroller (no edge-fade mask —
// RN masks need a native module; the scroller clips instead).

const FollowupSuggestionsRow = () => {
  const suggestions = useAuiState(
    (s) => s.thread.suggestions,
  ) as readonly {
    readonly prompt: string;
    readonly title?: string | null;
    readonly label?: string | null;
  }[];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="mx-auto flex min-h-8 w-max items-center gap-2 px-0.5"
      className="-my-1 w-full py-1"
    >
      {suggestions.map((suggestion, idx) => (
        <ThreadPrimitive.Suggestion
          key={idx}
          className="rounded-full border bg-background px-3 py-1 active:bg-muted/80"
          prompt={suggestion.prompt}
          send
        >
          <Text className="text-sm text-foreground">
            {suggestion.title ?? suggestion.prompt}
            {suggestion.label ? (
              <Text className="ml-1 text-muted-foreground">{suggestion.label}</Text>
            ) : null}
          </Text>
        </ThreadPrimitive.Suggestion>
      ))}
    </ScrollView>
  );
};

export const ThreadFollowupSuggestions = () => (
  <AuiIf
    condition={(s) =>
      !s.thread.isEmpty &&
      !s.thread.isRunning &&
      s.thread.suggestions.length > 0
    }
  >
    <FollowupSuggestionsRow />
  </AuiIf>
);
