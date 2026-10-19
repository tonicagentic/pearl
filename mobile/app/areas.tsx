import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { fetchIssues, type IssuesPayload } from "@/src/issues-client";
import { useAuth } from "@/src/auth";

/**
 * The area tree on mobile: the mind map visualization stays on the
 * web (Mermaid renders SVG in a DOM); here the same tree renders as an
 * indented list. Editing happens on the web too — this screen is read-only.
 */
export default function Areas() {
  const { signedIn, restoring } = useAuth();
  const [payload, setPayload] = useState<IssuesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  // SafeAreaView is a native codegen view — theme background through style.
  const backgroundColor = useCSSVariable("--color-background") as
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
          setError(cause instanceof Error ? cause.message : "Failed to load areas.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (restoring) return null;
  if (!signedIn) return <Redirect href="/" />;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor }}
      edges={["left", "right"]}
    >

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
              <Text className="py-1 text-sm text-muted-foreground">
                No areas yet.
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
