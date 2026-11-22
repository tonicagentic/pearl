import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  ScrollView,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AgentMark,
  pearlMarkMetrics,
} from "@/components/custom-agents/agent-mark";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import {
  AGENT_INTEGRATION_LABELS,
  type AgentIntegrationId,
} from "../../../lib/custom-agents/integrations";
import { DEFAULT_AGENT_MARK_HEIGHT_RATIO } from "../../../lib/custom-agents/mark";
import type { AgentTemplateDetail } from "../../../lib/custom-agents/template-types";
import {
  addAgentFromTemplateRequest,
  fetchAgentTemplate,
} from "@/src/agent-templates-client";
import { useChats } from "@/src/chat-context";
import { usePearlScreenBackground } from "@/src/navigation-theme";

const MARK_SIZE = 72;
const MARK_METRICS = pearlMarkMetrics(MARK_SIZE, DEFAULT_AGENT_MARK_HEIGHT_RATIO);

/** Template detail — review standing instructions / kit, then add or open. */
export function AgentTemplateDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selectChat } = useChats();
  const backgroundColor = usePearlScreenBackground();
  const params = useLocalSearchParams<{ readonly slug?: string }>();
  const slug = typeof params.slug === "string" ? params.slug : "";

  const [template, setTemplate] = useState<AgentTemplateDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    if (!slug) return;
    setError(null);
    void fetchAgentTemplate(slug)
      .then(setTemplate)
      .catch((cause) => {
        setError(
          cause instanceof Error ? cause.message : "Could not load template.",
        );
        setTemplate(null);
      });
  }, [slug]);

  useEffect(() => {
    reload();
  }, [reload]);

  const openAgentChat = (chatId: string) => {
    void selectChat(chatId).then((ok) => {
      if (!ok) return;
      router.push("/chat", { withAnchor: true });
    });
  };

  const addOrOpen = () => {
    if (!template || busy) return;
    if (template.addedChatId) {
      openAgentChat(template.addedChatId);
      return;
    }
    setBusy(true);
    setError(null);
    void addAgentFromTemplateRequest(template.slug)
      .then((agent) => {
        openAgentChat(agent.chatId);
      })
      .catch((cause) => {
        setError(
          cause instanceof Error ? cause.message : "Could not add agent.",
        );
        setBusy(false);
        reload();
      });
  };

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <Stack.Screen
        options={{
          title: template?.name ?? "Agent",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      {template === null && !error ? (
        <ActivityIndicator className="mt-16" />
      ) : error && !template ? (
        <View className="px-5 pt-8">
          <Text variant="secondary" tone="destructive">
            {error}
          </Text>
        </View>
      ) : template ? (
        <>
          <ScrollView
            className="flex-1"
            contentContainerClassName="gap-5 px-5 pb-6 pt-4"
            contentInsetAdjustmentBehavior="automatic"
          >
            <View className="flex-row items-start gap-4">
              <View
                style={{
                  width: MARK_METRICS.width,
                  height: MARK_METRICS.layoutHeight,
                }}
              >
                <AgentMark
                  accent={template.accent}
                  size={MARK_SIZE}
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

            <DetailSection
              title="Standing instructions"
              empty="None"
            >
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
          </ScrollView>

          <View
            className="border-t border-border px-5 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            <Button
              label={
                template.addedChatId
                  ? "Open agent"
                  : busy
                    ? "Adding…"
                    : "Add agent"
              }
              loading={busy}
              loadingLabel="Adding…"
              disabled={busy}
              onPress={addOrOpen}
            />
          </View>
        </>
      ) : null}
    </View>
  );
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
