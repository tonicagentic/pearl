import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { useCSSVariable } from "uniwind";

import {
  AgentMark,
  pearlMarkMetrics,
} from "@/components/custom-agents/agent-mark";
import { Text } from "@/components/ui/text";
import {
  AGENT_INTEGRATION_LABELS,
  type AgentIntegrationId,
} from "../../../lib/custom-agents/integrations";
import { DEFAULT_AGENT_MARK_HEIGHT_RATIO } from "../../../lib/custom-agents/mark";
import type {
  AgentTemplateDetail,
  AgentTemplateSummary,
} from "../../../lib/custom-agents/template-types";
import {
  fetchAgentTemplate,
  fetchAgentTemplates,
} from "@/src/agent-templates-client";

const LIST_MARK = 36;
const LIST_METRICS = pearlMarkMetrics(LIST_MARK, DEFAULT_AGENT_MARK_HEIGHT_RATIO);
const DETAIL_MARK = 72;
const DETAIL_METRICS = pearlMarkMetrics(
  DETAIL_MARK,
  DEFAULT_AGENT_MARK_HEIGHT_RATIO,
);

/** Filterable template rows for directory or in-sheet create flow. */
export function AgentTemplateList({
  onSelect,
  projectId = null,
}: {
  readonly onSelect: (slug: string) => void;
  readonly projectId?: string | null;
}) {
  const [templates, setTemplates] = useState<
    readonly AgentTemplateSummary[] | null
  >(null);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const reload = useCallback(() => {
    void fetchAgentTemplates(projectId ? { projectId } : undefined)
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
  }, [projectId]);

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
    <View className="gap-3 pb-2">
      <Text variant="body" tone="muted">
        Ready-made roles you can add as custom agents.
      </Text>

      <View className="flex-row flex-wrap gap-2">
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
      </View>

      <TextInput
        className="min-h-11 rounded-lg border border-border bg-card px-3 text-foreground"
        onChangeText={setQuery}
        placeholder="Search by name or description"
        placeholderTextColor={placeholderColor}
        value={query}
      />

      {error ? (
        <Text variant="secondary" tone="destructive">
          {error}
        </Text>
      ) : null}

      {templates === null ? (
        <ActivityIndicator className="mt-6" />
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
              onPress={() => onSelect(row.slug)}
            >
              <View
                style={{
                  width: LIST_METRICS.width,
                  height: LIST_METRICS.layoutHeight,
                }}
              >
                <AgentMark
                  accent={row.accent}
                  size={LIST_MARK}
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
    </View>
  );
}

/** Template detail body for directory screen or in-sheet create flow. */
export function AgentTemplateDetailBody({
  template,
  error,
}: {
  readonly template: AgentTemplateDetail | null;
  readonly error: string | null;
}) {
  if (template === null && !error) {
    return <ActivityIndicator className="mt-10" />;
  }
  if (error && !template) {
    return (
      <Text variant="secondary" tone="destructive">
        {error}
      </Text>
    );
  }
  if (!template) return null;

  return (
    <View className="gap-5 pb-2">
      <View className="flex-row items-start gap-4">
        <View
          style={{
            width: DETAIL_METRICS.width,
            height: DETAIL_METRICS.layoutHeight,
          }}
        >
          <AgentMark
            accent={template.accent}
            size={DETAIL_MARK}
            markShape={template.markShape}
            markTalk={template.markTalk}
            markBrows={template.markBrows}
            markGaze={template.markGaze}
            motion="idle"
            eyeMotion="idle"
          />
        </View>
        <View className="min-w-0 flex-1 gap-1">
          <Text variant="title" weight="semibold">
            {template.name}
          </Text>
          <Text variant="secondary" tone="muted">
            {template.category}
          </Text>
          <Text variant="body" className="mt-1">
            {template.description}
          </Text>
        </View>
      </View>

      {error ? (
        <Text variant="secondary" tone="destructive">
          {error}
        </Text>
      ) : null}

      <DetailSection title="Standing instructions">
        <Text variant="body" tone="muted">
          {template.instructions.trim() || "None"}
        </Text>
      </DetailSection>

      <DetailSection
        title="Memories"
        subtitle="Facts it already knows"
        empty="No starter facts."
        count={template.memories.length}
      >
        {template.memories.map((memory) => (
          <Text key={memory.text} variant="body" className="mb-1">
            {memory.text}
          </Text>
        ))}
      </DetailSection>

      <DetailSection
        title="Skills"
        subtitle="Playbooks it can run"
        empty="No starter skills."
        count={template.skills.length}
      >
        {template.skills.map((skill) => (
          <View key={skill.slug} className="mb-2">
            <Text variant="label" weight="semibold">
              {skill.title}
            </Text>
            <Text variant="secondary" tone="muted">
              {skill.description}
            </Text>
          </View>
        ))}
      </DetailSection>

      <DetailSection
        title="Routines"
        subtitle="Jobs that run on their own"
        empty="No starter routines."
        count={template.routines.length}
      >
        {template.routines.map((routine) => (
          <View key={routine.name} className="mb-2">
            <Text variant="label" weight="semibold">
              {routine.name}
            </Text>
            <Text variant="caption" tone="muted">
              {routine.cron} · {routine.timezone}
            </Text>
            <Text variant="secondary" tone="muted" className="mt-0.5">
              {routine.prompt}
            </Text>
          </View>
        ))}
      </DetailSection>

      <DetailSection
        title="Integrations"
        subtitle="Apps it can use"
        empty="No apps required."
        count={template.integrations.length}
      >
        {template.integrations.map((row) => (
          <Text key={row.connectionId} variant="body" className="mb-1">
            {AGENT_INTEGRATION_LABELS[
              row.connectionId as AgentIntegrationId
            ] ?? row.connectionId}
          </Text>
        ))}
      </DetailSection>
    </View>
  );
}

/** Load template detail for a slug; used by create-sheet and directory. */
export function useAgentTemplateDetail(
  slug: string | null,
  projectId: string | null = null,
) {
  const [template, setTemplate] = useState<AgentTemplateDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!slug) {
      setTemplate(null);
      setError(null);
      return;
    }
    setError(null);
    void fetchAgentTemplate(
      slug,
      projectId ? { projectId } : undefined,
    )
      .then(setTemplate)
      .catch((cause) => {
        setError(
          cause instanceof Error ? cause.message : "Could not load template.",
        );
        setTemplate(null);
      });
  }, [slug, projectId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { template, error, setError, reload };
}

function DetailSection({
  title,
  subtitle,
  empty,
  count,
  children,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly empty?: string;
  readonly count?: number;
  readonly children: ReactNode;
}) {
  const showEmpty = count !== undefined && count === 0;
  return (
    <View className="rounded-xl border border-border bg-card p-3">
      <Text variant="label" weight="semibold">
        {title}
      </Text>
      {subtitle ? (
        <Text variant="secondary" tone="muted" className="mt-0.5">
          {subtitle}
        </Text>
      ) : null}
      <View className="mt-2">
        {showEmpty ? (
          <Text variant="body" tone="muted">
            {empty}
          </Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}
