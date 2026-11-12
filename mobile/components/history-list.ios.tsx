import { useCallback } from "react";
import { View } from "react-native";
import {
  Button,
  ContextMenu,
  Host,
  HStack,
  Image,
  List,
  Section,
  Spacer,
  SwipeActions,
  Text as SwiftText,
} from "@expo/ui/swift-ui";
import {
  buttonStyle,
  font,
  foregroundStyle,
  lineLimit,
  listRowBackground,
  listRowInsets,
  listRowSpacing,
  listStyle,
  padding,
  scrollContentBackground,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { useAuth } from "@/src/auth";
import { useChats } from "@/src/chat-context";
import type { ChatListItem } from "@/src/chats-client";
import { formatChatUpdatedAt } from "@/src/format-chat-updated-at";

import type {
  HistoryChatActionHandlers,
  SidebarDestination,
} from "@/components/history-list";

export type { HistoryChatActionHandlers, SidebarDestination } from "@/components/history-list";

/**
 * iOS home: native inset-grouped List with swipe delete + context menu actions.
 */
export function HistoryListIOS({
  onOpenChat,
  onNavigate,
  actions,
}: {
  readonly onOpenChat: () => void;
  readonly onNavigate: (href: SidebarDestination) => void;
  readonly actions: HistoryChatActionHandlers;
}) {
  const { signedIn } = useAuth();
  const {
    chats,
    chatsLoading,
    chatsError,
    hasMoreChats,
    loadMoreChats,
    reloadChats,
    selectChat,
    selectionError,
  } = useChats();
  const insets = useSafeAreaInsets();
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;
  const rowBackground =
    (useCSSVariable("--color-card") as string | undefined) ??
    backgroundColor ??
    "#000000";
  const mutedColor =
    (useCSSVariable("--color-muted-foreground") as string | undefined) ??
    "#8E8E93";
  const amberColor = "#F59E0B";
  const listTopClearance = insets.top + 44;
  const iosSearchClearance = 52 + 24 + Math.max(insets.bottom, 12);
  const rowChrome = [
    listRowBackground(rowBackground),
    listRowInsets({ top: 14, bottom: 14, leading: 16, trailing: 16 }),
  ];

  const openChat = useCallback(
    (chatId: string) => {
      void selectChat(chatId).then((selected) => {
        if (selected) onOpenChat();
      });
    },
    [onOpenChat, selectChat],
  );

  const emptyLabel = chatsLoading
    ? "Loading history…"
    : chatsError
      ? "Couldn’t load history"
      : signedIn
        ? "No chats yet"
        : "Sign in to see chats";

  return (
    <View
      style={{
        flex: 1,
        backgroundColor,
        paddingTop: listTopClearance,
        paddingBottom: iosSearchClearance,
      }}
    >
      <Host
        style={{ flex: 1, backgroundColor }}
        useViewportSizeMeasurement
      >
        <List
          modifiers={[
            listStyle("insetGrouped"),
            // Drop the system grouped fill so the page background shows through.
            scrollContentBackground("hidden"),
            listRowSpacing(6),
          ]}
        >
          <Section>
            <Button
              label="Projects"
              systemImage="folder"
              onPress={() => onNavigate("/projects")}
              modifiers={[buttonStyle("plain"), ...rowChrome]}
            />
            <Button
              label="Tasks"
              systemImage="tray"
              onPress={() => onNavigate("/issues")}
              modifiers={[buttonStyle("plain"), ...rowChrome]}
            />
          </Section>

          <Section title="Recents">
            {selectionError ? (
              <SwiftText
                modifiers={[
                  foregroundStyle("#FF453A"),
                  font({ size: 15 }),
                  ...rowChrome,
                ]}
              >
                {selectionError}
              </SwiftText>
            ) : null}
            {chatsError && chats.length > 0 ? (
              <Button
                label={`${chatsError} Tap to retry.`}
                onPress={() => void reloadChats()}
                modifiers={[buttonStyle("plain"), ...rowChrome]}
              />
            ) : null}

            {chats.length === 0 ? (
              <SwiftText
                modifiers={[
                  foregroundStyle({ type: "hierarchical", style: "secondary" }),
                  font({ size: 15 }),
                  ...rowChrome,
                ]}
              >
                {emptyLabel}
              </SwiftText>
            ) : (
              <List.ForEach
                data={chats}
                keyExtractor={(chat) => chat.id}
                estimatedItemSize={64}
              >
                {({ item: chat }) => (
                  <RecentChatRow
                    chat={chat}
                    mutedColor={mutedColor}
                    amberColor={amberColor}
                    rowBackground={rowBackground}
                    onOpen={() => openChat(chat.id)}
                    actions={actions}
                  />
                )}
              </List.ForEach>
            )}

            {hasMoreChats ? (
              <Button
                label={chatsLoading ? "Loading…" : "Load more"}
                onPress={() => void loadMoreChats()}
                modifiers={[buttonStyle("plain"), ...rowChrome]}
              />
            ) : null}
          </Section>
        </List>
      </Host>
    </View>
  );
}

function RecentChatRow({
  chat,
  mutedColor,
  amberColor,
  rowBackground,
  onOpen,
  actions,
}: {
  readonly chat: ChatListItem;
  readonly mutedColor: string;
  readonly amberColor: string;
  readonly rowBackground: string;
  readonly onOpen: () => void;
  readonly actions: HistoryChatActionHandlers;
}) {
  const waiting = Boolean(chat.waitingForInput);
  const when = formatChatUpdatedAt(chat.updatedAt);
  const projectId = chat.projectId ?? null;
  const row = (
    <Button onPress={onOpen} modifiers={[buttonStyle("plain")]}>
      <HStack
        spacing={12}
        alignment="center"
        modifiers={[padding({ vertical: 6 })]}
      >
        <Image
          systemName="circle.fill"
          size={8}
          modifiers={[tint(waiting ? amberColor : mutedColor)]}
        />
        <SwiftText modifiers={[lineLimit(1), font({ size: 17 })]}>
          {chat.title}
        </SwiftText>
        <Spacer />
        {when ? (
          <SwiftText
            modifiers={[
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
              font({ size: 13 }),
            ]}
          >
            {when}
          </SwiftText>
        ) : null}
      </HStack>
    </Button>
  );

  return (
    <SwipeActions
      modifiers={[
        listRowBackground(rowBackground),
        listRowInsets({ top: 12, bottom: 12, leading: 16, trailing: 16 }),
      ]}
    >
      <ContextMenu>
        <ContextMenu.Trigger>{row}</ContextMenu.Trigger>
        <ContextMenu.Items>
          <Button
            label="Rename"
            systemImage="pencil"
            onPress={() => actions.onRename(chat)}
          />
          <Button
            label="View cost"
            systemImage="dollarsign.circle"
            onPress={() => actions.onViewCost(chat)}
          />
          <Button
            label={projectId ? "Move to project" : "Add to project"}
            systemImage="folder"
            onPress={() => actions.onMoveToProject(chat)}
          />
          {projectId ? (
            <Button
              label="Remove from project"
              systemImage="folder.badge.minus"
              onPress={() => actions.onRemoveFromProject(chat)}
            />
          ) : null}
          <Button
            label="Delete"
            systemImage="trash"
            role="destructive"
            onPress={() => actions.onDelete(chat)}
          />
        </ContextMenu.Items>
      </ContextMenu>
      <SwipeActions.Actions edge="trailing" allowsFullSwipe>
        <Button
          label="Delete"
          systemImage="trash"
          role="destructive"
          onPress={() => actions.onDelete(chat)}
        />
      </SwipeActions.Actions>
    </SwipeActions>
  );
}
