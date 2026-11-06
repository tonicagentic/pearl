import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { SheetScaffold } from "@/components/sheet-scaffold";
import { TextField } from "@/components/ui/text-field";
import {
  createSkillRequest,
  deleteSkillRequest,
  fetchSkills,
  installPublishedSkillRequest,
  previewPublishedSkillRequest,
  searchPublishedSkillsRequest,
  setSkillEnabledRequest,
  updateSkillRequest,
  type RegistrySearchHit,
  type RegistrySkillPackage,
  type SkillDto,
  type SkillFormInput,
} from "@/src/skills-client";

const MAX_DESCRIPTION = 300;

function slugFromTitle(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  if (!base) return "skill";
  return /^[0-9]/.test(base) ? `s-${base}` : base;
}

/**
 * Mobile skills manager: list, enable/disable, create/edit custom skills,
 * and install published packages from skills.sh. Mirrors web Settings → Skills
 * over `/api/skills`.
 */
export function SkillsScreen() {
  const [skills, setSkills] = useState<readonly SkillDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<
    | { kind: "closed" }
    | { kind: "create" }
    | { kind: "edit"; skill: SkillDto }
  >({ kind: "closed" });

  const reload = useCallback(async () => {
    try {
      setError(null);
      const payload = await fetchSkills();
      setSkills(payload.skills);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load skills.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const payload = await fetchSkills();
        if (!cancelled) {
          setSkills(payload.skills);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "Failed to load skills.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const upsertLocal = (row: SkillDto) => {
    setSkills((current) => {
      const list = current ?? [];
      const without = list.filter((skill) => skill.id !== row.id);
      return [...without, row];
    });
  };

  const removeLocal = (id: string) => {
    setSkills((current) => (current ?? []).filter((skill) => skill.id !== id));
  };

  const sorted = useMemo(
    () =>
      [...(skills ?? [])].sort((a, b) => a.title.localeCompare(b.title)),
    [skills],
  );

  const toggleEnabled = async (skill: SkillDto) => {
    setBusy(true);
    setError(null);
    try {
      const row = await setSkillEnabledRequest(skill.id, !skill.enabled);
      upsertLocal(row);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update skill.",
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = (skill: SkillDto) => {
    const run = async () => {
      setBusy(true);
      setError(null);
      try {
        await deleteSkillRequest(skill.id);
        removeLocal(skill.id);
        if (editor.kind === "edit" && editor.skill.id === skill.id) {
          setEditor({ kind: "closed" });
        }
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Could not delete skill.",
        );
      } finally {
        setBusy(false);
      }
    };

    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm(`Delete “${skill.title}”? Pearl will stop loading it.`)
      ) {
        void run();
      }
      return;
    }

    Alert.alert(
      `Delete “${skill.title}”?`,
      "Pearl will stop loading it on the next message.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void run() },
      ],
    );
  };

  const saveEditor = async (input: SkillFormInput) => {
    setBusy(true);
    setError(null);
    try {
      const row =
        editor.kind === "edit"
          ? await updateSkillRequest(editor.skill.id, input)
          : await createSkillRequest(input);
      upsertLocal(row);
      setEditor({ kind: "closed" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save skill.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <SheetScaffold title="Skills">
        {error ? (
          <Text className="px-1 text-[13px] text-destructive" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <View className="gap-1.5">
          <View className="flex-row items-center justify-between px-1">
            <Text className="text-[13px] font-normal uppercase tracking-[0.04em] text-muted-foreground">
              Your skills
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New skill"
              disabled={busy}
              className="min-h-10 justify-center rounded-xl px-3 active:bg-muted/60"
              onPress={() => {
                setError(null);
                setEditor({ kind: "create" });
              }}
            >
              <Text className="text-[15px] font-medium text-foreground">New</Text>
            </Pressable>
          </View>

          {skills === null ? (
            <ActivityIndicator accessibilityLabel="Loading skills" />
          ) : sorted.length === 0 ? (
            <View className="rounded-[10px] bg-card px-4 py-4">
              <Text className="text-[13px] text-muted-foreground">
                No custom skills yet. Create one, or install a published skill
                below.
              </Text>
            </View>
          ) : (
            <View className="overflow-hidden rounded-[10px] bg-card">
              {sorted.map((skill, index) => (
                <View
                  key={skill.id}
                  className={`gap-3 px-4 py-3 ${index > 0 ? "border-t border-border/40" : ""}`}
                >
                  <View className="gap-1">
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className="text-base font-medium text-foreground">
                        {skill.title}
                      </Text>
                      <Text className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {skill.slug}
                      </Text>
                      {skill.source === "registry" ? (
                        <Text className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          published
                        </Text>
                      ) : null}
                      {!skill.enabled ? (
                        <Text className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          disabled
                        </Text>
                      ) : null}
                    </View>
                    <Text className="text-sm text-muted-foreground" numberOfLines={2}>
                      {skill.description}
                    </Text>
                    {skill.registryName ? (
                      <Text
                        className="text-[11px] text-muted-foreground"
                        numberOfLines={1}
                      >
                        {skill.registryName}
                      </Text>
                    ) : null}
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    <ActionChip
                      disabled={busy}
                      label={skill.enabled ? "Disable" : "Enable"}
                      onPress={() => void toggleEnabled(skill)}
                    />
                    <ActionChip
                      disabled={busy}
                      label="Edit"
                      onPress={() => {
                        setError(null);
                        setEditor({ kind: "edit", skill });
                      }}
                    />
                    <ActionChip
                      disabled={busy}
                      destructive
                      label="Delete"
                      onPress={() => confirmDelete(skill)}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            className="min-h-11 justify-center px-1"
            onPress={() => void reload()}
          >
            <Text className="text-[13px] text-muted-foreground">Refresh</Text>
          </Pressable>
          <Text className="px-1 text-[13px] leading-[18px] text-muted-foreground">
            Description is the routing hint Pearl sees every turn. Saves apply
            on the next message.
          </Text>
        </View>

        <PublishedSkillsSection
          busy={busy}
          onBusy={setBusy}
          onError={setError}
          onInstalled={upsertLocal}
        />
    </SheetScaffold>

      <SkillEditorModal
        busy={busy}
        editor={editor}
        onCancel={() => setEditor({ kind: "closed" })}
        onSave={(input) => void saveEditor(input)}
      />
    </>
  );
}

function ActionChip({
  label,
  onPress,
  disabled,
  destructive,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      className="min-h-10 justify-center rounded-xl border border-border/60 px-3 active:bg-muted/60"
      onPress={onPress}
    >
      <Text
        className={`text-sm font-medium ${destructive ? "text-destructive" : "text-foreground"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SkillEditorModal({
  editor,
  busy,
  onCancel,
  onSave,
}: {
  readonly editor:
    | { kind: "closed" }
    | { kind: "create" }
    | { kind: "edit"; skill: SkillDto };
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onSave: (input: SkillFormInput) => void;
}) {
  const open = editor.kind !== "closed";
  const skill = editor.kind === "edit" ? editor.skill : null;
  const backgroundColor = useCSSVariable("--color-background") as
    | string
    | undefined;

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (editor.kind === "closed") return;
    const next = editor.kind === "edit" ? editor.skill : null;
    setTitle(next?.title ?? "");
    setSlug(next?.slug ?? "");
    setSlugTouched(Boolean(next));
    setDescription(next?.description ?? "");
    setMarkdown(next?.markdown ?? "");
    setEnabled(next?.enabled ?? true);
  }, [editor]);

  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      visible={open}
      onRequestClose={onCancel}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor }} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View className="flex-row items-center justify-between border-b border-border/60 px-4 py-3">
            <Pressable
              accessibilityRole="button"
              className="min-h-11 justify-center px-1"
              disabled={busy}
              onPress={onCancel}
            >
              <Text className="text-base text-muted-foreground">Cancel</Text>
            </Pressable>
            <Text className="text-base font-medium text-foreground">
              {skill ? "Edit skill" : "New skill"}
            </Text>
            <Pressable
              accessibilityRole="button"
              className="min-h-11 justify-center px-1"
              disabled={busy}
              onPress={() =>
                onSave({ title, slug, description, markdown, enabled })
              }
            >
              <Text className="text-base font-semibold text-foreground">
                {busy ? "Saving…" : "Save"}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerClassName="gap-4 px-5 py-5"
            keyboardShouldPersistTaps="handled"
          >
            <FieldLabel label="Title">
              <TextField
                editable={!busy}
                onChangeText={(next) => {
                  setTitle(next);
                  if (!slugTouched) setSlug(slugFromTitle(next));
                }}
                value={title}
              />
            </FieldLabel>
            <FieldLabel label="Slug">
              <TextField
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                onChangeText={(next) => {
                  setSlugTouched(true);
                  setSlug(next);
                }}
                value={slug}
              />
            </FieldLabel>
            <FieldLabel
              label="Description"
              hint={`Routing hint Pearl sees every turn (max ${String(MAX_DESCRIPTION)} characters).`}
            >
              <TextField
                editable={!busy}
                multiline
                maxLength={MAX_DESCRIPTION}
                onChangeText={setDescription}
                style={{ minHeight: 88, paddingTop: 14, paddingBottom: 14 }}
                textAlignVertical="top"
                value={description}
              />
            </FieldLabel>
            <FieldLabel
              label="Body"
              hint="Loaded only when Pearl activates the skill."
            >
              <TextField
                editable={!busy}
                multiline
                onChangeText={setMarkdown}
                style={{
                  minHeight: 200,
                  paddingTop: 14,
                  paddingBottom: 14,
                  fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                  fontSize: 13,
                }}
                textAlignVertical="top"
                value={markdown}
              />
            </FieldLabel>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: enabled }}
              className="min-h-12 flex-row items-center gap-3"
              disabled={busy}
              onPress={() => setEnabled((current) => !current)}
            >
              <View
                className={`size-5 items-center justify-center rounded border ${enabled ? "border-foreground bg-foreground" : "border-border bg-card"}`}
              >
                {enabled ? (
                  <Text className="text-[11px] font-bold text-background">✓</Text>
                ) : null}
              </View>
              <Text className="text-base text-foreground">Enabled</Text>
            </Pressable>
            {skill?.source === "registry" &&
            Object.keys(skill.files ?? {}).length > 0 ? (
              <Text className="text-[11px] text-muted-foreground">
                Package files ({Object.keys(skill.files).length}):{" "}
                {Object.keys(skill.files).sort().join(", ")}
              </Text>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function FieldLabel({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Text>
      {hint ? (
        <Text className="text-xs text-muted-foreground">{hint}</Text>
      ) : null}
      {children}
    </View>
  );
}

function PublishedSkillsSection({
  busy,
  onBusy,
  onError,
  onInstalled,
}: {
  readonly busy: boolean;
  readonly onBusy: (value: boolean) => void;
  readonly onError: (message: string | null) => void;
  readonly onInstalled: (row: SkillDto) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly RegistrySearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [preview, setPreview] = useState<RegistrySkillPackage | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);

  const runSearch = async () => {
    onError(null);
    setPreview(null);
    setSearching(true);
    try {
      const result = await searchPublishedSkillsRequest(query);
      setResults(result.items);
    } catch (cause) {
      onError(
        cause instanceof Error ? cause.message : "Could not search skills.sh.",
      );
    } finally {
      setSearching(false);
    }
  };

  return (
    <View className="gap-3">
      <View className="gap-1 px-1">
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Add a published skill
        </Text>
        <Text className="text-sm text-muted-foreground">
          Search skills.sh (including Vercel’s agent skills), preview, then
          install a copy for your account.
        </Text>
      </View>

      <View className="flex-row gap-2">
        <View className="flex-1">
          <TextField
            editable={!searching && !busy}
            onChangeText={setQuery}
            onSubmitEditing={() => void runSearch()}
            placeholder="Search skills.sh…"
            returnKeyType="search"
            value={query}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          className="min-h-[52px] justify-center rounded-2xl border border-border/60 bg-card px-4 active:bg-muted/60"
          disabled={searching || busy}
          onPress={() => void runSearch()}
        >
          <Text className="text-base font-medium text-foreground">
            {searching ? "…" : "Search"}
          </Text>
        </Pressable>
      </View>

      {results.length > 0 ? (
        <View className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          {results.map((item, index) => {
            const active = preview?.registryName === item.name;
            return (
              <View
                key={item.name}
                className={`gap-2 px-4 py-3 ${index > 0 ? "border-t border-border/40" : ""} ${active ? "bg-muted/40" : ""}`}
              >
                <Text className="text-base font-medium text-foreground">
                  {item.title}
                </Text>
                <Text className="text-sm text-muted-foreground" numberOfLines={2}>
                  {item.description || "No description."}
                </Text>
                <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                  {item.name}
                </Text>
                <ActionChip
                  disabled={busy || previewing === item.name}
                  label={previewing === item.name ? "Loading…" : "Preview"}
                  onPress={() => {
                    onError(null);
                    setPreviewing(item.name);
                    void previewPublishedSkillRequest(item.name)
                      .then((pkg) => setPreview(pkg))
                      .catch((cause: unknown) => {
                        onError(
                          cause instanceof Error
                            ? cause.message
                            : "Could not preview skill.",
                        );
                      })
                      .finally(() => setPreviewing(null));
                  }}
                />
              </View>
            );
          })}
        </View>
      ) : null}

      {preview ? (
        <View className="gap-3 rounded-2xl border border-border/60 bg-card px-4 py-4">
          <View className="flex-row items-start justify-between gap-2">
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-base font-medium text-foreground">
                {preview.title}
              </Text>
              <Text className="text-sm text-muted-foreground">
                {preview.description}
              </Text>
              <Text className="text-[11px] text-muted-foreground">
                {preview.registryName}
                {preview.author ? ` · ${preview.author}` : ""}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              className="min-h-10 justify-center px-2"
              disabled={busy}
              onPress={() => setPreview(null)}
            >
              <Text className="text-sm text-muted-foreground">Close</Text>
            </Pressable>
          </View>
          <View className="gap-1">
            <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              SKILL.md
            </Text>
            <Text className="rounded-xl bg-muted/40 p-3 font-mono text-[11px] leading-5 text-foreground">
              {preview.markdown.slice(0, 4_000)}
              {preview.markdown.length > 4_000 ? "\n…" : ""}
            </Text>
          </View>
          {preview.filePaths.length > 0 ? (
            <Text className="text-[11px] text-muted-foreground">
              Extra files ({preview.filePaths.length}):{" "}
              {preview.filePaths.slice(0, 12).join(", ")}
              {preview.filePaths.length > 12 ? "…" : ""}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            className="min-h-12 items-center justify-center rounded-2xl border border-border/60 bg-foreground px-4 active:opacity-80"
            disabled={busy}
            onPress={() => {
              onError(null);
              onBusy(true);
              void installPublishedSkillRequest(preview.registryName)
                .then((row) => {
                  onInstalled(row);
                  setPreview(null);
                })
                .catch((cause: unknown) => {
                  onError(
                    cause instanceof Error
                      ? cause.message
                      : "Could not install skill.",
                  );
                })
                .finally(() => onBusy(false));
            }}
          >
            <Text className="text-base font-medium text-background">
              {busy ? "Adding…" : "Add to my skills"}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
