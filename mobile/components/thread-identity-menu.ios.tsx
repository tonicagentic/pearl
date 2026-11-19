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

import { AgentIdentityPill } from "@/components/custom-agents/agent-identity-pill";
import type { ThreadIdentityMenuProps } from "./thread-identity-menu";

/**
 * Native menu on the identity pill: switch Pearl ↔ custom agents, then the
 * former ellipsis thread actions (and agent settings when applicable).
 */
export function ThreadIdentityMenu({
  name,
  accent,
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
  const label = name.trim() || "Pearl";
  const showSwitch = Boolean(
    allowAgentSwitch && onSelectPearl && onSelectAgent,
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
              <AgentIdentityPill name={label} accent={accent} />
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
                onPress={() => onSelectAgent(agent)}
              />
            ))}
          </Section>
        ) : null}
        {showSwitch ? <Divider /> : null}
        {showAgentSettings && onAgentSettings ? (
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
