import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { BookmarkIcon, CheckIcon } from "lucide-react-native";
import { useAuiState } from "@assistant-ui/react-native";
import * as Haptics from "expo-haptics";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useActiveChat } from "@/src/chat-context";
import {
  getActiveQuoteSelection,
  setActiveQuoteSelection,
} from "@/src/active-quote-selection";
import { MAX_QUOTE_LENGTH } from "../../../../lib/library/quote-text";
import { createQuote } from "@/src/quotes-client";
import { subscribeSelectionBookmark } from "@/modules/text-selection-menu";

type QuoteSelectionContextValue = {
  readonly selectedText: string | null;
  readonly reportSelection: (text: string | null) => void;
};

const QuoteSelectionContext = createContext<QuoteSelectionContextValue | null>(
  null,
);

async function saveQuoteText(input: {
  readonly text: string;
  readonly chatId: string | null;
  readonly messageId: string | null;
}): Promise<void> {
  await createQuote({
    text: input.text,
    chatId: input.chatId,
    messageId: input.messageId,
  });
}

/** App-wide: native Bookmark menu → Library quote. Mount once near chat root. */
export function SelectionBookmarkBridge() {
  useEffect(() => {
    const sub = subscribeSelectionBookmark((text) => {
      const active = getActiveQuoteSelection();
      const quoteText = (active?.text || text).trim();
      if (!quoteText) return;
      void saveQuoteText({
        text: quoteText,
        chatId: active?.chatId ?? null,
        messageId: active?.messageId ?? null,
      })
        .then(() => {
          setActiveQuoteSelection(null);
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          ).catch(() => {});
        })
        .catch(() => {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error,
          ).catch(() => {});
        });
    });
    return () => sub.remove();
  }, []);
  return null;
}

/** Per-message selection scope for settled assistant markdown. */
export function QuoteSelectionProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const running = useAuiState((s) => s.message.status?.type === "running");
  const messageId = useAuiState((s) => s.message.id);
  const { activeChatId } = useActiveChat();

  useEffect(() => {
    if (running) {
      setSelectedText(null);
      const current = getActiveQuoteSelection();
      if (current?.messageId === messageId) {
        setActiveQuoteSelection(null);
      }
    }
  }, [messageId, running]);

  const reportSelection = useCallback(
    (text: string | null) => {
      if (!text) {
        setSelectedText(null);
        const current = getActiveQuoteSelection();
        if (current?.messageId === messageId) {
          setActiveQuoteSelection(null);
        }
        return;
      }
      const trimmed = text.trim();
      if (!trimmed || trimmed.length > MAX_QUOTE_LENGTH) {
        setSelectedText(null);
        return;
      }
      setSelectedText(trimmed);
      setActiveQuoteSelection({
        text: trimmed,
        messageId,
        chatId: activeChatId,
      });
    },
    [activeChatId, messageId],
  );

  const value = useMemo(
    () => ({ selectedText, reportSelection }),
    [reportSelection, selectedText],
  );

  return (
    <QuoteSelectionContext.Provider value={value}>
      {children}
    </QuoteSelectionContext.Provider>
  );
}

export function useQuoteSelection(): QuoteSelectionContextValue | null {
  return useContext(QuoteSelectionContext);
}

const actionButtonClassName =
  "aui-assistant-action-button active:bg-muted size-7 items-center justify-center rounded-md";
const actionHitSlop = { top: 8, bottom: 8, left: 8, right: 8 };

/**
 * Action-bar bookmark fallback (Android / no native menu). With a live
 * selection, one tap saves; otherwise opens an editor for the full reply.
 */
export function SaveQuoteAction({
  markdown,
}: {
  readonly markdown: string;
}) {
  const selection = useQuoteSelection();
  const { activeChatId } = useActiveChat();
  const messageId = useAuiState((s) => s.message.id);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const hasSelection = Boolean(selection?.selectedText?.trim());

  const openEditor = useCallback(() => {
    const seed = selection?.selectedText?.trim() || markdown.trim();
    if (!seed) return;
    setDraft(seed.slice(0, MAX_QUOTE_LENGTH));
    setError(null);
    setSaved(false);
    setOpen(true);
  }, [markdown, selection?.selectedText]);

  const saveSelection = useCallback(() => {
    const text = selection?.selectedText?.trim();
    if (!text || saving || saved) return;
    setSaving(true);
    void saveQuoteText({
      text,
      chatId: activeChatId,
      messageId,
    })
      .then(() => {
        setSaving(false);
        setSaved(true);
        selection?.reportSelection(null);
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        setTimeout(() => setSaved(false), 1200);
      })
      .catch(() => {
        setSaving(false);
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error,
        ).catch(() => {});
      });
  }, [activeChatId, messageId, saved, saving, selection]);

  if (!markdown.trim() && !hasSelection) return null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          hasSelection
            ? "Save selected text as quote"
            : "Save quote to Library"
        }
        className={actionButtonClassName}
        hitSlop={actionHitSlop}
        disabled={saving}
        onPress={() => {
          if (hasSelection) {
            saveSelection();
            return;
          }
          openEditor();
        }}
      >
        {saving ? (
          <ActivityIndicator size="small" />
        ) : (
          <Icon
            as={saved ? CheckIcon : BookmarkIcon}
            className={
              saved || hasSelection
                ? "text-foreground size-4"
                : "text-muted-foreground size-4"
            }
            fill={hasSelection && !saved ? "currentColor" : "none"}
          />
        )}
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View className="bg-background flex-1 pt-3">
          <View className="flex-row items-center justify-between border-b border-border px-4 pb-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={() => setOpen(false)}
              hitSlop={8}
            >
              <Text variant="label" tone="muted">
                Cancel
              </Text>
            </Pressable>
            <Text variant="label" weight="medium">
              Save quote
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save"
              disabled={saving || !draft.trim()}
              hitSlop={8}
              onPress={() => {
                const text = draft.trim();
                if (!text || saving) return;
                setSaving(true);
                setError(null);
                void saveQuoteText({
                  text,
                  chatId: activeChatId,
                  messageId,
                })
                  .then(() => {
                    setSaving(false);
                    setSaved(true);
                    selection?.reportSelection(null);
                    setOpen(false);
                  })
                  .catch((cause) => {
                    setSaving(false);
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "Failed to save quote.",
                    );
                  });
              }}
            >
              {saving ? (
                <ActivityIndicator size="small" />
              ) : (
                <Text
                  variant="label"
                  weight="medium"
                  className={!draft.trim() ? "text-muted-foreground" : undefined}
                >
                  {saved ? "Saved" : "Save"}
                </Text>
              )}
            </Pressable>
          </View>

          <Text variant="caption" tone="muted" className="px-4 pt-3">
            Keep the passage you want in your Library.
          </Text>
          <TextInput
            multiline
            value={draft}
            onChangeText={(next) => setDraft(next.slice(0, MAX_QUOTE_LENGTH))}
            placeholder="Quote text"
            placeholderTextColor={placeholderColor}
            textAlignVertical="top"
            className="text-foreground flex-1 px-4 py-3 text-[16px] leading-6"
            autoFocus
          />
          {error ? (
            <Text variant="caption" tone="destructive" className="px-4 pb-4">
              {error}
            </Text>
          ) : (
            <Text variant="caption" tone="muted" className="px-4 pb-4">
              {draft.trim().length.toLocaleString("en-US")} /{" "}
              {MAX_QUOTE_LENGTH.toLocaleString("en-US")}
            </Text>
          )}
        </View>
      </Modal>
    </>
  );
}
