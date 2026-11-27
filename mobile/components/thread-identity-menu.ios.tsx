import {
  Button,
  Divider,
  Host,
  Menu,
  RNHostView,
  Section,
} from "@expo/ui/swift-ui";
import { accessibilityLabel } from "@expo/ui/swift-ui/modifiers";
import * as Haptics from "expo-haptics";
import { View } from "react-native";

import {
  AgentIdentityPill,
  ProjectIdentityPill,
} from "@/components/custom-agents/agent-identity-pill";
import { ProjectMark } from "@/components/project-mark";
import {
  PEARL_IDENTITY_ACCENT,
  PEARL_MARK_HEIGHT_RATIO,
} from "../../lib/custom-agents/mark";
import type {
  ThreadIdentityAgentOption,
  ThreadIdentityMenuProps,
} from "./thread-identity-menu";

export {
  PEARL_IDENTITY_ACCENT,
  PEARL_MARK_HEIGHT_RATIO,
  type ThreadIdentityAgentOption,
  type ThreadIdentityMenuProps,
};

/**
 * Native menu on the identity pill: switch Pearl ↔ custom agents, then the
 * former ellipsis thread actions (and agent settings when applicable).
 * Project-linked Pearl threads show the project mark/name instead.
 */
export function ThreadIdentityMenu({
  name,
  accent,
  markShape,
  markTalk,
  markBrows,
  markGaze,
  heightRatio,
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
  const label = projectAsTitle
    ? projectLabel?.trim() || name.trim() || "Project"
    : name.trim() || "Pearl";
  const showSwitch = Boolean(
    !projectAsTitle && allowAgentSwitch && onSelectPearl && onSelectAgent,
  );
  return (
    <Host matchContents style={{ backgroundColor: "transparent" }}>
      <Menu
        label={
          <RNHostView matchContents>
            <View
              onTouchStart={() => {
                void Haptics.impactAsync(
                  Haptics.ImpactFeedbackStyle.Light,
                ).catch(() => {});
              }}
            >
              {projectAsTitle ? (
                <ProjectIdentityPill
                  name={label}
                  mark={<ProjectMark name={label} size="sm" />}
                />
              ) : (
                <AgentIdentityPill
                  name={label}
                  accent={accent}
                  markShape={markShape}
                  markTalk={markTalk}
                  markBrows={markBrows}
                  markGaze={markGaze}
                  heightRatio={heightRatio}
                  motion="idle"
                />
              )}
            </View>
          </RNHostView>
        }
        modifiers={[accessibilityLabel(`${label} actions`)]}
      >
        {showSwitch ? (
          <Section title="Talking to">
            <Button
              label="Pearl"
              systemImage={currentAgentId == null ? "checkmark" : undefined}
              onPress={onSelectPearl}
            />
            {agents.map((agent) => (
              <Button
                key={agent.id}
                label={agent.name}
                systemImage={
                  agent.id === currentAgentId ? "checkmark" : undefined
                }
                onPress={() => onSelectAgent?.(agent)}
              />
            ))}
          </Section>
        ) : null}
        {showSwitch ? <Divider /> : null}
        {!projectAsTitle && showAgentSettings && onAgentSettings ? (
          <Button
            label="Agent settings"
            systemImage="gearshape"
            onPress={onAgentSettings}
          />
        ) : null}
        <Button
          label={projectLabel ? "Change project" : "Add to project"}
          systemImage="folder"
          onPress={onAddOrChangeProject}
        />
        {hasProject ? (
          <Button
            label="Remove from project"
            systemImage="folder.badge.minus"
            onPress={onRemoveProject}
          />
        ) : null}
        {canManageThread ? (
          <Button
            label="View cost"
            systemImage="dollarsign.circle"
            onPress={onViewCost}
          />
        ) : null}
        {canManageThread ? (
          <Button
            label="Delete"
            systemImage="trash"
            role="destructive"
            onPress={onDelete}
          />
        ) : null}
      </Menu>
    </Host>
  );
}
