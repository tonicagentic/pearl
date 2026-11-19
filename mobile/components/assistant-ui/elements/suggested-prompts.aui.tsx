import { Icon } from "@/components/ui/icon";
import { useAuth } from "@/src/auth";
import { AGENT_URL, getAuthCookie } from "@/src/eve-transport";
import { AuiIf, ThreadPrimitive } from "@assistant-ui/react-native";
import {
  ClapperboardIcon,
  CompassIcon,
  ImageIcon,
  LightbulbIcon,
  MessageCircleIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

type SuggestedPrompt = {
  readonly title: string;
  readonly prompt: string;
};

const SUGGESTION_ICONS: readonly LucideIcon[] = [
  SparklesIcon,
  ImageIcon,
  ClapperboardIcon,
  LightbulbIcon,
  MessageCircleIcon,
  CompassIcon,
];

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

  // Grok-style: a short left-aligned vertical stack above the composer.
  const visible = prompts.slice(0, 3);

  return (
    <View className="items-start gap-2.5 px-4 pb-3">
      {visible.map((suggestion, index) => {
        const Glyph = SUGGESTION_ICONS[index % SUGGESTION_ICONS.length]!;
        return (
          <ThreadPrimitive.Suggestion
            key={suggestion.prompt}
            className="max-w-full flex-row items-center gap-2.5 rounded-full bg-muted px-3.5 py-2.5 active:bg-muted/70"
            prompt={suggestion.prompt}
            send
          >
            <Icon as={Glyph} className="text-foreground/70 size-4 shrink-0" />
            <Text className="text-[15px] leading-5 text-muted-foreground" numberOfLines={1}>
              {suggestion.title}
            </Text>
          </ThreadPrimitive.Suggestion>
        );
      })}
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
