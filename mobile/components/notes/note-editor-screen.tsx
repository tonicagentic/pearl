import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Share,
  TextInput,
  View,
} from "react-native";
import { router, useNavigation } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { EllipsisIcon, ShareIcon } from "lucide-react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import {
  isEnrichedMarkdownNativeAvailable,
  MarkdownFormatToolbar,
  MarkdownRichEditor,
  type EnrichedMarkdownTextInputInstance,
  type StyleState,
} from "@/components/markdown-rich-editor";
import { ScreenChrome } from "@/components/navigation/screen-chrome";
import { LoadingCenter } from "@/components/ui/loading-center";
import { Text } from "@/components/ui/text";
import {
  KeyboardStickyView,
  useKeyboardHandler,
} from "@/src/keyboard-controller";
import {
  deleteNoteRequest,
  fetchNote,
  updateNoteRequest,
  type NoteDto,
} from "@/src/notes-client";
import { queryKeys } from "@/src/query-client";

const SAVE_DEBOUNCE_MS = 800;
const FORMAT_BAR_HEIGHT = 48;
const ENRICHED_NATIVE = isEnrichedMarkdownNativeAvailable();

function formatNoteDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Canonical note editor — loads by noteId via GET /api/notes/[id]. */
export function NoteEditorScreen({
  noteId,
}: {
  readonly noteId: string;
}) {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const placeholderColor = useCSSVariable("--color-muted-foreground") as
    | string
    | undefined;

  const [note, setNote] = useState<NoteDto | null>(null);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [styleState, setStyleState] = useState<StyleState | null>(null);
  const [bodyFocused, setBodyFocused] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const editorRef = useRef<EnrichedMarkdownTextInputInstance | null>(null);
  const noteRef = useRef<NoteDto | null>(null);
  const titleRef = useRef(title);
  const markdownRef = useRef(markdown);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const flushGenerationRef = useRef(0);
  const keyboardHeight = useSharedValue(0);

  useEffect(() => {
    noteRef.current = note;
  }, [note]);
  useEffect(() => {
    titleRef.current = title;
  }, [title]);
  useEffect(() => {
    markdownRef.current = markdown;
  }, [markdown]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const row = await fetchNote(noteId);
        if (!cancelled) {
          setNote(row);
          setTitle(row.title);
          setMarkdown(row.markdown);
          titleRef.current = row.title;
          markdownRef.current = row.markdown;
          noteRef.current = row;
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "Failed to load note.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  const invalidateNotes = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.notes });
  }, [queryClient]);

  const persistNow = useCallback(async (): Promise<boolean> => {
    const current = noteRef.current;
    if (!current) return true;
    const sentTitle = titleRef.current.trim() || noteRef.current?.title || "Note";
    const sentMarkdown = markdownRef.current;
    const dirty =
      sentTitle !== current.title || sentMarkdown !== current.markdown;
    if (!dirty) return true;
    if (savingRef.current) return false;

    savingRef.current = true;
    setSaving(true);
    setError(null);
    const generation = ++flushGenerationRef.current;
    try {
      const row = await updateNoteRequest(noteId, {
        title: sentTitle,
        markdown: sentMarkdown,
      });
      if (flushGenerationRef.current === generation) {
        noteRef.current = row;
        setNote(row);
        // Only snap draft if the user hasn't typed further since this save.
        if (
          (titleRef.current.trim() || noteRef.current?.title || "Note") ===
            sentTitle &&
          markdownRef.current === sentMarkdown
        ) {
          setTitle(row.title);
          setMarkdown(row.markdown);
          titleRef.current = row.title;
          markdownRef.current = row.markdown;
        }
        invalidateNotes();
      }
      return true;
    } catch (cause) {
      if (flushGenerationRef.current === generation) {
        setError(
          cause instanceof Error ? cause.message : "Could not save note.",
        );
      }
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [invalidateNotes, noteId]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void persistNow();
    }, SAVE_DEBOUNCE_MS);
  }, [persistNow]);

  const flushPendingSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persistNow();
  }, [persistNow]);

  // Flush on unmount so a killed screen still persists the last draft.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const current = noteRef.current;
      if (!current) return;
      const sentTitle = titleRef.current.trim() || noteRef.current?.title || "Note";
      const sentMarkdown = markdownRef.current;
      if (
        sentTitle === current.title &&
        sentMarkdown === current.markdown
      ) {
        return;
      }
      void updateNoteRequest(noteId, {
        title: sentTitle,
        markdown: sentMarkdown,
      }).then(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.notes });
      });
    };
  }, [noteId, queryClient]);

  // Flush before stack pop / swipe-back so the list sees the latest title.
  useEffect(() => {
    type BeforeRemoveEvent = {
      preventDefault: () => void;
      data: { action: unknown };
    };
    const nav = navigation as unknown as {
      addListener: (
        type: "beforeRemove",
        listener: (event: BeforeRemoveEvent) => void,
      ) => () => void;
      dispatch: (action: unknown) => void;
    };
    const unsub = nav.addListener("beforeRemove", (event) => {
      const current = noteRef.current;
      if (!current) return;
      const sentTitle = titleRef.current.trim() || noteRef.current?.title || "Note";
      const sentMarkdown = markdownRef.current;
      const dirty =
        sentTitle !== current.title ||
        sentMarkdown !== current.markdown ||
        saveTimerRef.current != null;
      if (!dirty) return;

      event.preventDefault();
      void flushPendingSave().finally(() => {
        nav.dispatch(event.data.action);
      });
    });
    return unsub;
  }, [flushPendingSave, navigation]);

  const syncKeyboardOpen = useCallback((open: boolean) => {
    setKeyboardOpen(open);
  }, []);

  useKeyboardHandler({
    onStart: (event) => {
      "worklet";
      const height = Math.max(0, event.height);
      keyboardHeight.value = height;
      runOnJS(syncKeyboardOpen)(height > 0);
    },
    onMove: (event) => {
      "worklet";
      keyboardHeight.value = Math.max(0, event.height);
    },
    onInteractive: (event) => {
      "worklet";
      keyboardHeight.value = Math.max(0, event.height);
    },
    onEnd: (event) => {
      "worklet";
      const height = Math.max(0, event.height);
      keyboardHeight.value = height;
      runOnJS(syncKeyboardOpen)(height > 0);
    },
  });

  const restingPad = Math.max(insets.bottom, 8);
  const showFormatBar =
    ENRICHED_NATIVE && keyboardOpen && bodyFocused;
  const formatBarPad = useSharedValue(0);

  useEffect(() => {
    formatBarPad.value = showFormatBar ? FORMAT_BAR_HEIGHT : 0;
  }, [formatBarPad, showFormatBar]);

  const editorPadStyle = useAnimatedStyle(() => {
    const kb = Math.max(0, keyboardHeight.value - restingPad);
    return {
      paddingBottom: formatBarPad.value + kb,
    };
  }, [restingPad]);

  const onChangeTitle = useCallback(
    (next: string) => {
      setTitle(next);
      titleRef.current = next;
      scheduleSave();
    },
    [scheduleSave],
  );

  const onChangeMarkdown = useCallback(
    (next: string) => {
      setMarkdown(next);
      markdownRef.current = next;
      scheduleSave();
    },
    [scheduleSave],
  );

  const confirmDelete = useCallback(() => {
    Alert.alert("Delete note?", titleRef.current || note?.title || "Note", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
          }
          void deleteNoteRequest(noteId)
            .then(() => {
              invalidateNotes();
              if (router.canGoBack()) router.back();
              else router.replace("/notes");
            })
            .catch((cause) => {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Could not delete note.",
              );
            });
        },
      },
    ]);
  }, [invalidateNotes, noteId]);

  const shareNote = useCallback(() => {
    const shareTitle = titleRef.current.trim() || note?.title || "Note";
    const body = markdownRef.current.trim();
    const message = body ? `${shareTitle}\n\n${body}` : shareTitle;
    void Share.share({ message, title: shareTitle }).catch(() => {});
  }, []);

  const headerActions = useMemo(
    () => [
      {
        label: "Share",
        systemImage: "square.and.arrow.up" as const,
        icon: ShareIcon,
        onPress: shareNote,
      },
      {
        type: "menu" as const,
        label: "More",
        systemImage: "ellipsis" as const,
        icon: EllipsisIcon,
        onPress: confirmDelete,
        items: [
          {
            label: "Delete",
            systemImage: "trash" as const,
            destructive: true,
            onPress: confirmDelete,
          },
        ],
      },
    ],
    [confirmDelete, shareNote],
  );

  const dateLabel = note ? formatNoteDate(note.updatedAt) : null;
  const statusLabel = error
    ? "Couldn't save"
    : saving
      ? "Saving…"
      : null;

  if (!note) {
    return (
      <ScreenChrome title="Note" leading="back" contentPaddingTop={0}>
        {error ? (
          <View className="flex-1 items-center justify-center px-5">
            <Text className="text-center text-sm text-destructive">{error}</Text>
          </View>
        ) : (
          <LoadingCenter />
        )}
      </ScreenChrome>
    );
  }

  const loadedNote = note;

  return (
    <ScreenChrome
      title=""
      leading="back"
      contentPaddingTop={0}
      actions={headerActions}
    >
      <View className="flex-1">
        <Animated.View style={[{ flex: 1 }, editorPadStyle]}>
          <View className="px-5 pt-2">
            {error ? (
              <Text className="mb-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </Text>
            ) : null}

            <TextInput
              className="text-foreground text-[28px] font-bold leading-9"
              onBlur={() => {
                void flushPendingSave();
              }}
              onChangeText={onChangeTitle}
              placeholder="Title"
              placeholderTextColor={placeholderColor}
              returnKeyType="next"
              value={title}
            />

            <View className="mt-1 mb-2 flex-row flex-wrap items-center gap-x-2 gap-y-0.5">
              {dateLabel ? (
                <Text variant="caption" tone="muted">
                  {dateLabel}
                </Text>
              ) : null}
              {loadedNote.projectName ? (
                <Text variant="caption" tone="muted">
                  · {loadedNote.projectName}
                </Text>
              ) : null}
              {statusLabel ? (
                <Text
                  variant="caption"
                  tone={error ? "destructive" : "muted"}
                >
                  · {statusLabel}
                </Text>
              ) : null}
            </View>
          </View>

          <MarkdownRichEditor
            key={loadedNote.id}
            className="flex-1"
            defaultValue={loadedNote.markdown}
            editorRef={editorRef}
            onBlur={() => {
              setBodyFocused(false);
              void flushPendingSave();
            }}
            onChangeMarkdown={onChangeMarkdown}
            onChangeState={setStyleState}
            onFocus={() => setBodyFocused(true)}
            placeholder="Start writing…"
            variant="document"
          />
        </Animated.View>

        {showFormatBar ? (
          <KeyboardStickyView
            offset={{ closed: 0, opened: 0 }}
            style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
          >
            <MarkdownFormatToolbar
              editorRef={editorRef}
              styleState={styleState}
            />
          </KeyboardStickyView>
        ) : null}
      </View>
    </ScreenChrome>
  );
}
