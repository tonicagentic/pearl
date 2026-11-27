import { useEffect, useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useCSSVariable } from "uniwind";

import { AgentMarkPicker } from "@/components/custom-agents/agent-mark-picker";
import {
  AgentTemplateDetailBody,
  AgentTemplateList,
  useAgentTemplateDetail,
} from "@/components/home/agent-template-browser";
import { AddComposer } from "@/components/ui/add-composer";
import { Text, textVariants } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import {
  DEFAULT_AGENT_MARK_ACCENT,
  DEFAULT_AGENT_MARK_BROWS,
  DEFAULT_AGENT_MARK_GAZE,
  DEFAULT_AGENT_MARK_SHAPE,
  DEFAULT_AGENT_MARK_TALK,
  type AgentMarkShape,
  type AgentMarkTalk,
} from "../../../lib/custom-agents/mark";
import { addAgentFromTemplateRequest } from "@/src/agent-templates-client";
import { useActiveChat } from "@/src/chat-context";
import {
  createCustomAgentRequest,
  type CustomAgentDto,
} from "@/src/custom-agents-client";
import {
  fetchProjects,
  type ProjectDto,
} from "@/src/projects-client";

type Phase =
  | "project"
  | "name"
  | "instructions"
  | "character"
  | "templates"
  | "templateDetail";

/** New custom-agent wizard: Project → Name → Instructions → Character, or templates. */
export function CreateAgentModal({
  open,
  onClose,
  onCreated,
  projectId: fixedProjectId = null,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCreated: (agent: CustomAgentDto) => void;
  readonly projectId?: string | null;
}) {
  const router = useRouter();
  const { selectChat } = useActiveChat();
  const [phase, setPhase] = useState<Phase>(
    fixedProjectId ? "name" : "project",
  );
  const [projects, setProjects] = useState<readonly ProjectDto[]>([]);
  const [projectId, setProjectId] = useState(fixedProjectId ?? "");
  const [templateSlug, setTemplateSlug] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [accent, setAccent] = useState<string>(DEFAULT_AGENT_MARK_ACCENT);
  const [markShape, setMarkShape] = useState<AgentMarkShape>(
    DEFAULT_AGENT_MARK_SHAPE,
  );
  const [markTalk, setMarkTalk] = useState<AgentMarkTalk>(
    DEFAULT_AGENT_MARK_TALK,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const {
    template,
    error: templateError,
    setError: setTemplateError,
    reload: reloadTemplate,
  } = useAgentTemplateDetail(
    phase === "templateDetail" ? templateSlug : null,
    projectId || null,
  );

  useEffect(() => {
    if (!open) return;
    setPhase(fixedProjectId ? "name" : "project");
    setProjectId(fixedProjectId ?? "");
    setTemplateSlug(null);
    setName("");
    setInstructions("");
    setAccent(DEFAULT_AGENT_MARK_ACCENT);
    setMarkShape(DEFAULT_AGENT_MARK_SHAPE);
    setMarkTalk(DEFAULT_AGENT_MARK_TALK);
    setError(null);
    setBusy(false);
    if (!fixedProjectId) {
      void fetchProjects()
        .then(setProjects)
        .catch(() => setProjects([]));
    }
  }, [open, fixedProjectId]);

  const create = () => {
    if (busy || name.trim().length === 0 || !projectId) return;
    setBusy(true);
    setError(null);
    void createCustomAgentRequest({
      projectId,
      name: name.trim(),
      instructions: instructions.trim() || undefined,
      accent,
      markShape,
      markTalk,
      markBrows: DEFAULT_AGENT_MARK_BROWS,
      markGaze: DEFAULT_AGENT_MARK_GAZE,
    })
      .then(onCreated)
      .catch((cause) => {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not create the agent.",
        );
        setBusy(false);
      });
  };

  const openAgentChat = (chatId: string) => {
    onClose();
    void selectChat(chatId).then((ok) => {
      if (!ok) return;
      router.push("/chat", { withAnchor: true });
    });
  };

  const addFromTemplate = () => {
    if (!template || busy || !projectId) return;
    if (template.addedChatId) {
      openAgentChat(template.addedChatId);
      return;
    }
    setBusy(true);
    setTemplateError(null);
    void addAgentFromTemplateRequest(template.slug, projectId)
      .then(onCreated)
      .catch((cause) => {
        setTemplateError(
          cause instanceof Error ? cause.message : "Could not add agent.",
        );
        setBusy(false);
        reloadTemplate();
      });
  };

  const goBack = () => {
    setError(null);
    if (phase === "templateDetail") {
      setPhase("templates");
      setTemplateSlug(null);
      return;
    }
    if (phase === "templates") {
      setPhase("name");
      return;
    }
    if (phase === "project") {
      onClose();
      return;
    }
    if (phase === "name") {
      if (fixedProjectId) {
        onClose();
        return;
      }
      setPhase("project");
      return;
    }
    if (phase === "instructions") {
      setPhase("name");
      return;
    }
    setPhase("instructions");
  };

  const primary = () => {
    if (phase === "project") {
      if (!projectId) {
        Alert.alert("Choose a project", "Agents belong to a project.");
        return;
      }
      setPhase("name");
      return;
    }
    if (phase === "name") {
      if (name.trim().length === 0) return;
      setError(null);
      setPhase("instructions");
      return;
    }
    if (phase === "instructions") {
      setError(null);
      setPhase("character");
      return;
    }
    if (phase === "templateDetail") {
      addFromTemplate();
      return;
    }
    create();
  };

  const browsingTemplates =
    phase === "templates" || phase === "templateDetail";
  const naming = phase === "name";
  const sheetTitle =
    phase === "project"
      ? "Choose project"
      : phase === "templates"
        ? "Templates"
        : phase === "templateDetail"
          ? (template?.name ?? "Template")
          : "New agent";

  const canSubmit =
    phase === "templates"
      ? false
      : phase === "project"
        ? Boolean(projectId) && !busy
        : phase === "name"
          ? name.trim().length > 0 && !busy
          : phase === "templateDetail"
            ? Boolean(template) && Boolean(projectId) && !busy
            : !busy;

  return (
    <AddComposer
      open={open}
      onClose={onClose}
      onSubmit={primary}
      canSubmit={canSubmit}
      busy={
        busy && (phase === "character" || phase === "templateDetail")
      }
      sheetTitle={sheetTitle}
      submitLabel={
        phase === "templateDetail"
          ? template?.addedChatId
            ? "Open agent"
            : "Add agent"
          : phase === "character"
            ? "Create agent"
            : "Continue"
      }
      submitAccessibilityLabel={
        phase === "templateDetail"
          ? template?.addedChatId
            ? "Open agent"
            : "Add agent"
          : phase === "character"
            ? "Create agent"
            : phase === "instructions"
              ? "Continue to character"
              : "Continue"
      }
      leading={phase === "project" || (naming && Boolean(fixedProjectId)) ? "close" : "back"}
      onLeadingPress={
        phase === "project" || (naming && Boolean(fixedProjectId))
          ? onClose
          : goBack
      }
      showTitleField={naming}
      title={name}
      onChangeTitle={setName}
      titlePlaceholder="Agent name"
      titleAccessibilityLabel="Agent name"
      titleMaxLength={80}
      titleAutoFocus={naming}
      scrollable={!naming}
      showSubmit={phase !== "templates"}
      error={browsingTemplates ? null : error}
      footer={
        naming ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose from a template"
            className="self-center rounded-full border border-border bg-card px-4 py-2 active:opacity-80"
            onPress={() => {
              if (!projectId) {
                Alert.alert("Choose a project", "Pick a project first.");
                return;
              }
              setError(null);
              setPhase("templates");
            }}
          >
            <Text variant="label" weight="semibold">
              Choose from a template
            </Text>
          </Pressable>
        ) : undefined
      }
      hero={
        phase === "character" ? (
          <AgentMarkPicker
            accent={accent}
            markShape={markShape}
            markTalk={markTalk}
            showBrows={false}
            showGaze={false}
            onAccentChange={setAccent}
            onMarkShapeChange={setMarkShape}
            onMarkTalkChange={setMarkTalk}
          />
        ) : undefined
      }
    >
      {phase === "project" ? (
        <View className="gap-2 px-1 pb-2">
          {projects.length === 0 ? (
            <Text variant="body" className="text-muted-foreground">
              No projects yet. Create one in Workspaces first — it comes with a
              manager.
            </Text>
          ) : (
            projects.map((row) => {
              const selected = projectId === row.id;
              return (
                <Pressable
                  key={row.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={cn(
                    "rounded-xl border px-3 py-3",
                    selected
                      ? "border-foreground bg-foreground"
                      : "border-border bg-card",
                  )}
                  onPress={() => setProjectId(row.id)}
                >
                  <Text
                    variant="label"
                    weight="semibold"
                    className={selected ? "text-background" : "text-foreground"}
                  >
                    {row.name}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      ) : null}
      {phase === "templates" ? (
        <AgentTemplateList
          projectId={projectId}
          onSelect={(slug) => {
            setTemplateSlug(slug);
            setPhase("templateDetail");
          }}
        />
      ) : null}
      {phase === "templateDetail" ? (
        <AgentTemplateDetailBody
          template={template}
          error={templateError}
        />
      ) : null}
      {phase === "instructions" ? (
        <TextInput
          accessibilityLabel="Standing instructions"
          autoFocus
          className={cn("min-h-32", textVariants({ variant: "body" }))}
          multiline
          onChangeText={setInstructions}
          placeholder="Standing instructions…"
          placeholderTextColor={placeholderColor}
          textAlignVertical="top"
          value={instructions}
        />
      ) : null}
    </AddComposer>
  );
}
