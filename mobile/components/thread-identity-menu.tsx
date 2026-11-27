import * as Haptics from "expo-haptics";
import { Alert } from "react-native";

import {
  AgentIdentityPill,
  ProjectIdentityPill,
} from "@/components/custom-agents/agent-identity-pill";
import { ProjectMark } from "@/components/project-mark";
import {
  DEFAULT_AGENT_MARK_HEIGHT_RATIO,
  PEARL_IDENTITY_ACCENT,
  PEARL_MARK_HEIGHT_RATIO,
  type AgentMarkBrows,
  type AgentMarkGaze,
  type AgentMarkShape,
  type AgentMarkTalk,
} from "../../lib/custom-agents/mark";

export { PEARL_IDENTITY_ACCENT, PEARL_MARK_HEIGHT_RATIO };

export type ThreadIdentityAgentOption = {
  readonly id: string;
  readonly name: string;
  readonly accent: string;
  readonly markShape?: AgentMarkShape;
  readonly markTalk?: AgentMarkTalk;
  readonly markBrows?: AgentMarkBrows;
  readonly markGaze?: AgentMarkGaze;
  readonly chatId: string;
};

export type ThreadIdentityMenuProps = {
  readonly name: string;
  readonly accent?: string;
  readonly markShape?: AgentMarkShape;
  readonly markTalk?: AgentMarkTalk;
  readonly markBrows?: AgentMarkBrows;
  readonly markGaze?: AgentMarkGaze;
  /** Rounder for built-in Pearl; tall oval for custom agents. */
  readonly heightRatio?: number;
  /**
   * When true, the pill shows the project mark + projectLabel (not Pearl/agent)
   * and skips agent switch / settings.
   */
  readonly projectAsTitle?: boolean;
  readonly projectLabel: string | null;
  readonly hasProject: boolean;
  readonly canManageThread: boolean;
  readonly showAgentSettings?: boolean;
  readonly onAgentSettings?: () => void;
  readonly onAddOrChangeProject: () => void;
  readonly onRemoveProject: () => void;
  readonly onViewCost: () => void;
  readonly onDelete: () => void;
  /** When set, the menu can switch Pearl ↔ custom agents. */
  readonly allowAgentSwitch?: boolean;
  readonly agents?: readonly ThreadIdentityAgentOption[];
  /** null = Pearl (default assistant). */
  readonly currentAgentId?: string | null;
  readonly onSelectPearl?: () => void;
  readonly onSelectAgent?: (agent: ThreadIdentityAgentOption) => void;
};

function openThreadActionsMenu(props: {
  readonly title: string;
  readonly projectAsTitle: boolean;
  readonly projectLabel: string | null;
  readonly hasProject: boolean;
  readonly canManageThread: boolean;
  readonly showAgentSettings: boolean;
  readonly onAgentSettings?: () => void;
  readonly onAddOrChangeProject: () => void;
  readonly onRemoveProject: () => void;
  readonly onViewCost: () => void;
  readonly onDelete: () => void;
  readonly allowAgentSwitch: boolean;
  readonly agents: readonly ThreadIdentityAgentOption[];
  readonly currentAgentId: string | null;
  readonly onSelectPearl?: () => void;
  readonly onSelectAgent?: (agent: ThreadIdentityAgentOption) => void;
}) {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  const buttons: {
    text: string;
    style?: "cancel" | "destructive" | "default";
    onPress?: () => void;
  }[] = [];
  if (
    !props.projectAsTitle &&
    props.allowAgentSwitch &&
    props.onSelectPearl &&
    props.onSelectAgent
  ) {
    buttons.push({
      text: props.currentAgentId == null ? "✓ Pearl" : "Pearl",
      onPress: props.onSelectPearl,
    });
    for (const agent of props.agents) {
      const selected = agent.id === props.currentAgentId;
      buttons.push({
        text: selected ? `✓ ${agent.name}` : agent.name,
        onPress: () => props.onSelectAgent?.(agent),
      });
    }
  }
  if (!props.projectAsTitle && props.showAgentSettings && props.onAgentSettings) {
    buttons.push({ text: "Agent settings", onPress: props.onAgentSettings });
  }
  buttons.push({
    text: props.projectLabel ? "Change project" : "Add to project",
    onPress: props.onAddOrChangeProject,
  });
  if (props.hasProject) {
    buttons.push({
      text: "Remove from project",
      onPress: props.onRemoveProject,
    });
  }
  if (props.canManageThread) {
    buttons.push(
      { text: "View cost", onPress: props.onViewCost },
      {
        text: "Delete",
        style: "destructive",
        onPress: props.onDelete,
      },
    );
  }
  buttons.push({ text: "Cancel", style: "cancel" });
  Alert.alert(props.title.trim() || "Thread", undefined, buttons);
}

/** Android / web: tap the identity pill for agent switch + thread actions. */
export function ThreadIdentityMenu({
  name,
  accent,
  markShape,
  markTalk,
  markBrows,
  markGaze,
  heightRatio = DEFAULT_AGENT_MARK_HEIGHT_RATIO,
  projectAsTitle = false,
  projectLabel,
  hasProject,
  canManageThread,
  showAgentSettings = false,
  onAgentSettings,
  onAddOrChangeProject,
  onRemoveProject,
  onViewCost,
  onDelete,
  allowAgentSwitch = false,
  agents = [],
  currentAgentId = null,
  onSelectPearl,
  onSelectAgent,
}: ThreadIdentityMenuProps) {
  const openMenu = () =>
    openThreadActionsMenu({
      title: projectAsTitle
        ? projectLabel?.trim() || name
        : name,
      projectAsTitle,
      projectLabel,
      hasProject,
      canManageThread,
      showAgentSettings,
      onAgentSettings,
      onAddOrChangeProject,
      onRemoveProject,
      onViewCost,
      onDelete,
      allowAgentSwitch,
      agents,
      currentAgentId,
      onSelectPearl,
      onSelectAgent,
    });

  if (projectAsTitle) {
    const label = projectLabel?.trim() || name.trim() || "Project";
    return (
      <ProjectIdentityPill
        name={label}
        mark={<ProjectMark name={label} size="sm" />}
        onPress={openMenu}
      />
    );
  }

  return (
    <AgentIdentityPill
      name={name}
      accent={accent}
      markShape={markShape}
      markTalk={markTalk}
      markBrows={markBrows}
      markGaze={markGaze}
      heightRatio={heightRatio}
      motion="idle"
      onPress={openMenu}
    />
  );
}
