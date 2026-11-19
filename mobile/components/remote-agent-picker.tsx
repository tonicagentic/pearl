import {
  Alert,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import {
  BottomSheetModal,
  type BottomSheetModal as BottomSheetModalRef,
} from "@expo/ui/community/bottom-sheet";
import { BotIcon, CheckIcon } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { composerControlHitSlop } from "@/components/assistant-ui/elements/icon-button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useChats } from "@/src/chat-context";
import {
  listConnectedAgents,
  setChatRemoteAgent,
} from "@/src/connected-agents-client";
import {
  getConnectedAgentsCache,
  getRemoteAgentSelection,
  remoteAgentLabel,
  setConnectedAgentsCache,
  setRemoteAgentSelection,
  subscribeConnectedAgentsCache,
  subscribeRemoteAgentSelection,
} from "@/src/remote-agent-selection";

const SHEET_SNAP_POINTS = ["50%"] as const;

/** Composer agent switcher; hidden until at least one agent is connected. */
export function ComposerRemoteAgentPicker({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const sheetRef = useRef<BottomSheetModalRef>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { activeChatId, activeCustomAgent } = useChats();
  const selectedId = useSyncExternalStore(
    subscribeRemoteAgentSelection,
    getRemoteAgentSelection,
    getRemoteAgentSelection,
  );
  const agents = useSyncExternalStore(
    subscribeConnectedAgentsCache,
    getConnectedAgentsCache,
    getConnectedAgentsCache,
  );

  useEffect(() => {
    let cancelled = false;
    void listConnectedAgents()
      .then((data) => {
        if (!cancelled) setConnectedAgentsCache(data.agents);
      })
      .catch(() => {
        // Picker stays hidden when the list cannot load.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    setMenuOpen(true);
    sheetRef.current?.present();
  }, [disabled]);

  const finishClose = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const closeMenu = useCallback(() => {
    sheetRef.current?.dismiss();
    finishClose();
  }, [finishClose]);

  const select = useCallback(
    (id: string | null) => {
      setRemoteAgentSelection(id);
      closeMenu();
      if (activeChatId) {
        void setChatRemoteAgent(activeChatId, id).catch((cause) => {
          Alert.alert(
            "Could not save agent",
            cause instanceof Error ? cause.message : String(cause),
          );
        });
      }
    },
    [activeChatId, closeMenu],
  );

  if (activeCustomAgent || agents.length === 0) return null;

  const label = remoteAgentLabel(selectedId, agents);

  return (
    <View>
      <Pressable
        accessibilityLabel={`Agent: ${label}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: menuOpen, disabled }}
        className="bg-muted active:bg-muted/80 size-11 items-center justify-center rounded-full"
        disabled={disabled}
        hitSlop={composerControlHitSlop}
        onPress={openMenu}
        style={disabled ? { opacity: 0.5 } : undefined}
      >
        <Icon as={BotIcon} className="text-muted-foreground size-5" />
      </Pressable>

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={[...SHEET_SNAP_POINTS]}
        enablePanDownToClose
        onClose={finishClose}
      >
        <ScrollView
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom, 16) + 16,
            paddingHorizontal: 16,
            gap: 4,
          }}
        >
          <Text className="text-muted-foreground mb-2 text-xs font-medium uppercase">
            Agent
          </Text>
          <OptionRow
            label="Pearl"
            detail="This Pearl agent"
            selected={selectedId === null}
            onPress={() => select(null)}
          />
          {agents.map((agent) => (
            <OptionRow
              key={agent.id}
              label={agent.label}
              detail={safeHost(agent.url)}
              selected={selectedId === agent.id}
              onPress={() => select(agent.id)}
            />
          ))}
        </ScrollView>
      </BottomSheetModal>
    </View>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function OptionRow({
  label,
  detail,
  selected,
  onPress,
}: {
  readonly label: string;
  readonly detail: string;
  readonly selected: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className="flex-row items-center gap-3 rounded-xl px-2 py-3 active:bg-muted"
      onPress={onPress}
    >
      <Icon
        as={CheckIcon}
        className={selected ? "text-foreground size-4" : "size-4 opacity-0"}
      />
      <View className="min-w-0 flex-1">
        <Text className="text-foreground text-base font-medium">{label}</Text>
        <Text className="text-muted-foreground text-xs">{detail}</Text>
      </View>
    </Pressable>
  );
}
