import * as Haptics from "expo-haptics";
import { Alert } from "react-native";

import { AgentIdentityPill } from "@/components/custom-agents/agent-identity-pill";
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

/** Android / web: tap the identity pill for agent switch + thread actions. */
export function ThreadIdentityMenu({
  name,
  accent,
  markShape,
  markTalk,
  markBrows,
  markGaze,
  heightRatio = DEFAULT_AGENT_MARK_HEIGHT_RATIO,
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
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
          () => {},
        );
        const buttons: {
          text: string;
          style?: "cancel" | "destructive" | "default";
          onPress?: () => void;
        }[] = [];
        if (allowAgentSwitch && onSelectPearl && onSelectAgent) {
          buttons.push({
            text: currentAgentId == null ? "✓ Pearl" : "Pearl",
            onPress: onSelectPearl,
          });
          for (const agent of agents) {
            const selected = agent.id === currentAgentId;
            buttons.push({
              text: selected ? `✓ ${agent.name}` : agent.name,
              onPress: () => onSelectAgent(agent),
            });
          }
        }
        if (showAgentSettings && onAgentSettings) {
          buttons.push({ text: "Agent settings", onPress: onAgentSettings });
        }
        buttons.push({
          text: projectLabel ? "Change project" : "Add to project",
          onPress: onAddOrChangeProject,
        });
        if (hasProject) {
          buttons.push({
            text: "Remove from project",
            onPress: onRemoveProject,
          });
        }
        if (canManageThread) {
          buttons.push(
            { text: "View cost", onPress: onViewCost },
            {
              text: "Delete",
              style: "destructive",
              onPress: onDelete,
            },
          );
        }
        buttons.push({ text: "Cancel", style: "cancel" });
        Alert.alert(name.trim() || "Thread", undefined, buttons);
      }}
    />
  );
}
