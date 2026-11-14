import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import { useCSSVariable } from "uniwind";

import { StackScreen } from "@/components/ui/stack-screen";
import { fetchIssues, type IssuesPayload } from "@/src/issues-client";

/**
 * The area tree on mobile: the mind map visualization stays on the
 * web (Mermaid renders SVG in a DOM); here the same tree renders as an
 * indented list. Editing happens on the web too — this screen is read-only.
 */
export function AreasScreen() {
  const [payload, setPayload] = useState<IssuesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const foregroundColor = useCSSVariable("--color-foreground") as
    | string
    | undefined;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchIssues();

        if (!cancelled) {
          setPayload(data);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "Failed to load areas.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <StackScreen>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Areas",
          headerTintColor: foregroundColor,
        }}
      />

      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-10">
        <Text className="mb-4 text-sm text-muted-foreground">
          The stable areas of your life. They are never “done” — issues come and
          go underneath them. Edit the tree on the web.
        </Text>

        {error ? (
          <View className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
            <Text className="text-sm text-destructive">{error}</Text>
          </View>
        ) : !payload ? (
          <Text className="text-sm text-muted-foreground">Loading…</Text>
        ) : (
          <View className="rounded-lg border bg-card px-3 py-3">
            {(payload.options ?? []).map((option) => (
              <Text
                key={option.id}
                numberOfLines={1}
                className="py-1 text-sm text-foreground"
              >
                {option.label.trim()}
              </Text>
            ))}
            {(payload.options ?? []).length === 0 ? (
              <View className="py-3">
                <Text className="text-base font-medium text-foreground">
                  No areas yet
                </Text>
                <Text className="text-muted-foreground mt-1 text-sm leading-5">
                  Areas are the stable parts of your life. Create them on the
                  web, then they will show up here.
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </StackScreen>
  );
}
