import { useAuth } from "@/src/auth";
import { AGENT_URL, getAuthCookie } from "@/src/eve-transport";
import { AuiIf, ThreadPrimitive } from "@assistant-ui/react-native";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";

type SuggestedPrompt = {
  readonly title: string;
  readonly prompt: string;
};

let cachedPrompts: readonly SuggestedPrompt[] = [];

function authHeaders(): Record<string, string> {
  const credential = getAuthCookie();
  return {
    ...(credential ? { authorization: `Bearer ${credential}` } : {}),
  };
}

async function fetchSuggestedPrompts(): Promise<readonly SuggestedPrompt[]> {
  const response = await fetch(`${AGENT_URL}/api/chat/suggested-prompts`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as {
    prompts?: SuggestedPrompt[];
  };
  if (!Array.isArray(data.prompts)) {
    return [];
  }
  return data.prompts.filter(
    (item): item is SuggestedPrompt =>
      typeof item?.title === "string" &&
      typeof item?.prompt === "string" &&
      item.title.trim().length > 0 &&
      item.prompt.trim().length > 0,
  );
}

const SuggestedPromptsRow = () => {
  const { signedIn, isAnonymous } = useAuth();
  const canFetch = signedIn && !isAnonymous;
  const [prompts, setPrompts] = useState<readonly SuggestedPrompt[]>(
    () => cachedPrompts,
  );
  const [ready, setReady] = useState(cachedPrompts.length > 0);

  useEffect(() => {
    if (!canFetch) {
      cachedPrompts = [];
      setPrompts([]);
      setReady(false);
      return;
    }

    let cancelled = false;
    void fetchSuggestedPrompts().then((next) => {
      if (cancelled) return;
      cachedPrompts = next;
      setPrompts(next);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [canFetch]);

  if (!canFetch || !ready || prompts.length === 0) {
    return null;
  }

  return (
    <View className="px-4 pb-2">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="mx-auto flex min-h-8 w-max items-center gap-2 px-0.5"
        className="-my-1 w-full py-1"
      >
        {prompts.map((suggestion) => (
          <ThreadPrimitive.Suggestion
            key={suggestion.prompt}
            className="rounded-full border bg-background px-3 py-1 active:bg-muted/80"
            prompt={suggestion.prompt}
            send
          >
            <Text className="text-sm text-foreground">{suggestion.title}</Text>
          </ThreadPrimitive.Suggestion>
        ))}
      </ScrollView>
    </View>
  );
};

/** Personalized starter chips above the composer on an empty new chat. */
export const ThreadSuggestedPrompts = () => (
  <AuiIf
    condition={(s) =>
      s.thread.messages.length === 0 &&
      (!s.thread.isLoading || s.threads.isLoading)
    }
  >
    <SuggestedPromptsRow />
  </AuiIf>
);
