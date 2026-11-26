import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  View,
} from "react-native";
import { useIsFocused, useRouter } from "expo-router";
import { RefreshCwIcon } from "lucide-react-native";

import {
  ScreenChrome,
  type ScreenChromeAction,
} from "@/components/navigation/screen-chrome";
import { Text } from "@/components/ui/text";
import {
  createWorkbenchPin,
  fetchWorkbenchPins,
  type SuggestedPinDto,
  type WorkbenchPinDto,
} from "@/src/workbench-client";

function goHomeOrBack(router: ReturnType<typeof useRouter>) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace("/");
}

/** Pinned repos for phone management of GitHub / Vercel / Expo. */
export function WorkbenchScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const [pins, setPins] = useState<WorkbenchPinDto[]>([]);
  const [suggested, setSuggested] = useState<SuggestedPinDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchWorkbenchPins();
      setPins([...data.pins]);
      setSuggested(data.suggested);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load pins.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Stale `/repos` → `/workbench` redirects often leave this as the stack
    // root with no back target. Bounce to Mail home instead of trapping here.
    if (!router.canGoBack()) {
      router.replace("/");
      return;
    }
    void reload();
  }, [reload, router]);

  const pinSuggested = useCallback(async () => {
    if (!suggested) return;
    try {
      await createWorkbenchPin(suggested);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not pin repo.");
    }
  }, [reload, suggested]);

  const chromeActions = useMemo((): readonly ScreenChromeAction[] => {
    if (!focused) return [];
    return [
      {
        label: "Refresh",
        systemImage: "arrow.clockwise",
        icon: RefreshCwIcon,
        onPress: () => void reload(),
      },
    ];
  }, [focused, reload]);

  return (
    <ScreenChrome
      title="Repos"
      leading="back"
      onBack={() => goHomeOrBack(router)}
      contentPaddingTop={0}
      actions={chromeActions}
    >
      {error ? (
        <Pressable className="px-4 py-3" onPress={() => void reload()}>
          <Text className="text-sm text-destructive">{error} Tap to retry.</Text>
        </Pressable>
      ) : null}

      {suggested ? (
        <View className="mx-4 mb-3 rounded-xl border border-border bg-card px-3 py-3">
          <Text className="text-sm font-medium text-foreground">
            Suggested pin
          </Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            {suggested.owner}/{suggested.name}
          </Text>
          <Pressable
            accessibilityRole="button"
            className="mt-2 self-start rounded-lg bg-primary px-3 py-1.5"
            onPress={() => void pinSuggested()}
          >
            <Text className="text-sm font-medium text-primary-foreground">
              Pin Pearl
            </Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        className="flex-1 px-4"
        data={pins}
        keyExtractor={(pin) => pin.id}
        contentInsetAdjustmentBehavior="automatic"
        ListEmptyComponent={
          loading ? (
            <View className="py-8">
              <ActivityIndicator />
            </View>
          ) : error ? undefined : (
            <View className="py-8">
              <Text className="text-base font-medium text-foreground">
                No pinned repos
              </Text>
              <Text className="mt-1.5 text-sm leading-5 text-muted-foreground">
                Pin a GitHub repo to manage PRs, Vercel deploys, and Expo builds
                from your phone. Ask Pearl in chat to work on any repo you can
                open.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            className="mb-2 rounded-xl border border-border bg-card px-3 py-3"
            onPress={() => router.push(`/workbench/${item.id}`)}
          >
            <Text className="text-base font-medium text-foreground">
              {item.fullName}
            </Text>
            <Text className="mt-1 text-xs text-muted-foreground">
              {[
                item.vercelProjectId ? "Vercel" : null,
                item.expoProjectId ? "Expo" : null,
              ]
                .filter(Boolean)
                .join(" · ") || "GitHub"}
            </Text>
          </Pressable>
        )}
      />
    </ScreenChrome>
  );
}
