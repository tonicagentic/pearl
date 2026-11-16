import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  View,
} from "react-native";
import { useCSSVariable } from "uniwind";

import {
  SettingsButton,
  SettingsField,
  SettingsForm,
  SettingsFormText,
  SettingsLabeledValue,
  SettingsPicker,
  SettingsSection,
} from "@/components/settings/native";
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
      <SettingsForm
        footer={
          <SettingsFormText tone="secondary">
            Description is the routing hint Pearl sees every turn. Saves apply
            on the next message.
          </SettingsFormText>
        }
      >
        {error ? (
          <SettingsFormText tone="destructive">{error}</SettingsFormText>
        ) : null}

        <SettingsSection title="Your skills">
          <SettingsButton
            disabled={busy}
            label="New skill"
            onPress={() => {
              setError(null);
              setEditor({ kind: "create" });
            }}
          />
          <SettingsButton
            disabled={busy}
            label="Refresh"
            onPress={() => void reload()}
            variant="plain"
          />
        </SettingsSection>

        {skills === null ? (
          <ActivityIndicator accessibilityLabel="Loading skills" />
        ) : sorted.length === 0 ? (
          <SettingsFormText tone="secondary">
            No custom skills yet. Create one, or install a published skill
            below.
          </SettingsFormText>
        ) : (
          sorted.map((skill) => (
            <SettingsSection
              key={skill.id}
              title={skill.title}
              footer={
                <SettingsFormText tone="secondary">
                  {[
                    skill.slug,
                    skill.source === "registry" ? "published" : null,
                    !skill.enabled ? "disabled" : null,
                    skill.registryName,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </SettingsFormText>
              }
            >
              <SettingsLabeledValue
                label="Description"
                value={skill.description || "—"}
              />
              <SettingsButton
                disabled={busy}
                label={skill.enabled ? "Disable" : "Enable"}
                onPress={() => void toggleEnabled(skill)}
              />
              <SettingsButton
                disabled={busy}
                label="Edit"
                onPress={() => {
                  setError(null);
                  setEditor({ kind: "edit", skill });
                }}
              />
              <SettingsButton
                destructive
                disabled={busy}
                label="Delete"
                onPress={() => confirmDelete(skill)}
              />
            </SettingsSection>
          ))
        )}

        <PublishedSkillsSection
          busy={busy}
          onBusy={setBusy}
          onError={setError}
          onInstalled={upsertLocal}
        />
      </SettingsForm>

      <SkillEditorModal
        busy={busy}
        editor={editor}
        onCancel={() => setEditor({ kind: "closed" })}
        onSave={(input) => void saveEditor(input)}
      />
    </>
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
      <View style={{ flex: 1, backgroundColor }}>
        <SettingsForm>
          <SettingsSection title={skill ? "Edit skill" : "New skill"}>
            <SettingsField
              label="Title"
              onChangeText={(next) => {
                setTitle(next);
                if (!slugTouched) setSlug(slugFromTitle(next));
              }}
              value={title}
            />
            <SettingsField
              label="Slug"
              onChangeText={(next) => {
                setSlugTouched(true);
                setSlug(next);
              }}
              value={slug}
            />
            <SettingsField
              label="Description"
              multiline
              onChangeText={setDescription}
              placeholder={`Routing hint (max ${String(MAX_DESCRIPTION)})`}
              value={description}
            />
            <SettingsField
              label="Body"
              multiline
              onChangeText={setMarkdown}
              placeholder="Loaded only when Pearl activates the skill."
              value={markdown}
            />
            <SettingsPicker
              label="Enabled"
              onSelectionChange={(value) => setEnabled(value === "Yes")}
              options={["Yes", "No"]}
              selection={enabled ? "Yes" : "No"}
            />
            {skill?.source === "registry" &&
            Object.keys(skill.files ?? {}).length > 0 ? (
              <SettingsFormText tone="secondary">
                {`Package files (${Object.keys(skill.files).length}): ${Object.keys(skill.files).sort().join(", ")}`}
              </SettingsFormText>
            ) : null}
          </SettingsSection>

          <SettingsSection>
            <SettingsButton
              disabled={busy}
              label={busy ? "Saving…" : "Save"}
              onPress={() =>
                onSave({ title, slug, description, markdown, enabled })
              }
            />
            <SettingsButton
              disabled={busy}
              label="Cancel"
              onPress={onCancel}
              variant="plain"
            />
          </SettingsSection>
        </SettingsForm>
      </View>
    </Modal>
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
    <>
      <SettingsSection
        title="Add a published skill"
        footer={
          <SettingsFormText tone="secondary">
            Search skills.sh (including Vercel’s agent skills), preview, then
            install a copy for your account.
          </SettingsFormText>
        }
      >
        <SettingsField
          label="Search"
          onChangeText={setQuery}
          placeholder="Search skills.sh…"
          value={query}
        />
        <SettingsButton
          disabled={searching || busy}
          label={searching ? "Searching…" : "Search"}
          onPress={() => void runSearch()}
        />
      </SettingsSection>

      {results.map((item) => {
        const active = preview?.registryName === item.name;
        return (
          <SettingsSection
            key={item.name}
            title={item.title}
            footer={
              <SettingsFormText tone="secondary">
                {[item.description || "No description.", item.name]
                  .filter(Boolean)
                  .join(" · ")}
              </SettingsFormText>
            }
          >
            <SettingsButton
              disabled={busy || previewing === item.name}
              label={
                previewing === item.name
                  ? "Loading…"
                  : active
                    ? "Selected"
                    : "Preview"
              }
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
          </SettingsSection>
        );
      })}

      {preview ? (
        <SettingsSection
          title={preview.title}
          footer={
            <SettingsFormText tone="secondary">
              {[
                preview.description,
                preview.registryName,
                preview.author ? `by ${preview.author}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </SettingsFormText>
          }
        >
          <SettingsLabeledValue
            label="SKILL.md"
            value={
              preview.markdown.slice(0, 4_000) +
              (preview.markdown.length > 4_000 ? "\n…" : "")
            }
          />
          {preview.filePaths.length > 0 ? (
            <SettingsFormText tone="secondary">
              {`Extra files (${preview.filePaths.length}): ${preview.filePaths.slice(0, 12).join(", ")}${preview.filePaths.length > 12 ? "…" : ""}`}
            </SettingsFormText>
          ) : null}
          <SettingsButton
            disabled={busy}
            label={busy ? "Adding…" : "Add to my skills"}
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
          />
          <SettingsButton
            disabled={busy}
            label="Close preview"
            onPress={() => setPreview(null)}
            variant="plain"
          />
        </SettingsSection>
      ) : null}
    </>
  );
}
