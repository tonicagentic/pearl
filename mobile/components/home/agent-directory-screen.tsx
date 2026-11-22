import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useCSSVariable } from "uniwind";

import {
  AgentMark,
  pearlMarkMetrics,
} from "@/components/custom-agents/agent-mark";
import { ScreenChrome } from "@/components/navigation/screen-chrome";
import { Text } from "@/components/ui/text";
import { DEFAULT_AGENT_MARK_HEIGHT_RATIO } from "../../../lib/custom-agents/mark";
import type { AgentTemplateSummary } from "../../../lib/custom-agents/template-types";
import { fetchAgentTemplates } from "@/src/agent-templates-client";

const MARK_SIZE = 36;
const MARK_METRICS = pearlMarkMetrics(MARK_SIZE, DEFAULT_AGENT_MARK_HEIGHT_RATIO);

/** Template directory list — tap a row to open details, then add from there. */
export function AgentDirectoryScreen() {
  const router = useRouter();
  const [templates, setTemplates] = useState<readonly AgentTemplateSummary[] | null>(
    null,
  );
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const reload = useCallback(() => {
    void fetchAgentTemplates()
      .then((rows) => {
        setTemplates(rows);
        setError(null);
      })
      .catch((cause) => {
        setError(
          cause instanceof Error ? cause.message : "Could not load directory.",
        );
        setTemplates((current) => current ?? []);
      });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const row of templates ?? []) set.add(row.category);
    return ["All", ...[...set].sort((a, b) => a.localeCompare(b))];
  }, [templates]);

  const filtered = useMemo(() => {
    const rows = templates ?? [];
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (category !== "All" && row.category !== category) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q)
      );
    });
  }, [templates, category, query]);

  return (
    <ScreenChrome title="Directory" leading="drawer" wrapBody={false}>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="px-4 pb-10 pt-2"
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="body" tone="muted" className="mb-3">
          Ready-made roles you can add as custom agents.
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-3"
          contentContainerClassName="gap-2"
        >
          {categories.map((name) => (
            <Pressable
              key={name}
              onPress={() => setCategory(name)}
              className={`rounded-full border px-3 py-1.5 ${
                category === name
                  ? "border-foreground bg-foreground"
                  : "border-border bg-card"
              }`}
            >
              <Text
                variant="secondary"
                className={
                  category === name ? "text-background" : "text-muted-foreground"
                }
              >
                {name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <TextInput
          className="mb-4 min-h-11 rounded-lg border border-border bg-card px-3 text-foreground"
          onChangeText={setQuery}
          placeholder="Search by name or description"
          placeholderTextColor={placeholderColor}
          value={query}
        />

        {error ? (
          <Text variant="secondary" tone="destructive" className="mb-3">
            {error}
          </Text>
        ) : null}

        {templates === null ? (
          <ActivityIndicator className="mt-8" />
        ) : filtered.length === 0 ? (
          <Text variant="body" tone="muted">
            No templates match.
          </Text>
        ) : (
          <View className="gap-2">
            {filtered.map((row) => (
              <Pressable
                key={row.slug}
                accessibilityRole="button"
                accessibilityLabel={`${row.name}. ${row.description}`}
                className="flex-row items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 active:opacity-80"
                onPress={() =>
                  router.push(`/agent-directory/${row.slug}`, {
                    withAnchor: true,
                  })
                }
              >
                <View
                  style={{
                    width: MARK_METRICS.width,
                    height: MARK_METRICS.layoutHeight,
                  }}
                >
                  <AgentMark
                    accent={row.accent}
                    size={MARK_SIZE}
                    markShape={row.markShape}
                    markTalk={row.markTalk}
                    markBrows={row.markBrows}
                    markGaze={row.markGaze}
                    motion="off"
                  />
                </View>
                <View className="min-w-0 flex-1">
                  <Text variant="label" weight="semibold" numberOfLines={1}>
                    {row.name}
                  </Text>
                  <Text variant="secondary" tone="muted" numberOfLines={2}>
                    {row.description}
                  </Text>
                  {row.addedChatId ? (
                    <Text variant="caption" tone="muted" className="mt-1">
                      Already added
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenChrome>
  );
}
