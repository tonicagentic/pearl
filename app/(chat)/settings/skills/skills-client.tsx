"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Loader2Icon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";

import {
  createSkillAction,
  deleteSkillAction,
  installPublishedSkillAction,
  previewPublishedSkillAction,
  searchPublishedSkillsAction,
  setSkillEnabledAction,
  updateSkillAction,
} from "@/app/actions/skills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { UserSkill } from "@/lib/db/schema";
import type {
  RegistrySearchHit,
  RegistrySkillPackage,
} from "@/lib/skills/registry";
import {
  MAX_CUSTOM_MARKDOWN_LENGTH,
  MAX_SKILL_DESCRIPTION_LENGTH,
  slugFromTitle,
} from "@/lib/skills/validation";
import { cn } from "@/lib/utils";

type EditorMode =
  | { readonly kind: "closed" }
  | { readonly kind: "create" }
  | { readonly kind: "edit"; readonly skill: UserSkill };

export function SkillsSettings({
  initialSkills,
}: {
  readonly initialSkills: readonly UserSkill[];
}) {
  const [skills, setSkills] = useState<readonly UserSkill[]>(initialSkills);
  const [editor, setEditor] = useState<EditorMode>({ kind: "closed" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sorted = useMemo(
    () => [...skills].sort((a, b) => a.title.localeCompare(b.title)),
    [skills],
  );

  const upsertLocal = (row: UserSkill) => {
    setSkills((current) => {
      const without = current.filter((skill) => skill.id !== row.id);
      return [...without, row];
    });
  };

  const removeLocal = (id: string) => {
    setSkills((current) => current.filter((skill) => skill.id !== id));
  };

  return (
    <div className="flex flex-col gap-8">
      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Your skills</h2>
          <Button
            disabled={pending}
            onClick={() => {
              setError(null);
              setEditor({ kind: "create" });
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            <PlusIcon className="size-3.5" />
            New skill
          </Button>
        </div>

        {sorted.length === 0 ? (
          <p className="rounded-lg border bg-card px-3 py-4 text-sm text-muted-foreground">
            No custom skills yet. Create one, or install a published skill
            below.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {sorted.map((skill) => (
              <li
                className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
                key={skill.id}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {skill.title}
                    </span>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {skill.slug}
                    </code>
                    {skill.source === "registry" ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        published
                      </span>
                    ) : null}
                    {!skill.enabled ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        disabled
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {skill.description}
                  </p>
                  {skill.registryName ? (
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">
                      {skill.registryName}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <Button
                    disabled={pending}
                    onClick={() => {
                      setError(null);
                      startTransition(async () => {
                        try {
                          const row = await setSkillEnabledAction(
                            skill.id,
                            !skill.enabled,
                          );
                          upsertLocal(row);
                        } catch (cause) {
                          setError(
                            cause instanceof Error
                              ? cause.message
                              : "Could not update skill.",
                          );
                        }
                      });
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {skill.enabled ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    disabled={pending}
                    onClick={() => {
                      setError(null);
                      setEditor({ kind: "edit", skill });
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Edit
                  </Button>
                  <Button
                    disabled={pending}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Delete “${skill.title}”? Pearl will stop loading it.`,
                        )
                      ) {
                        return;
                      }
                      setError(null);
                      startTransition(async () => {
                        try {
                          await deleteSkillAction(skill.id);
                          removeLocal(skill.id);
                          if (
                            editor.kind === "edit" &&
                            editor.skill.id === skill.id
                          ) {
                            setEditor({ kind: "closed" });
                          }
                        } catch (cause) {
                          setError(
                            cause instanceof Error
                              ? cause.message
                              : "Could not delete skill.",
                          );
                        }
                      });
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2Icon className="size-3.5" />
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {editor.kind !== "closed" ? (
          <SkillEditor
            key={editor.kind === "edit" ? editor.skill.id : "create"}
            pending={pending}
            skill={editor.kind === "edit" ? editor.skill : null}
            onCancel={() => setEditor({ kind: "closed" })}
            onSave={(input) => {
              setError(null);
              startTransition(async () => {
                try {
                  const row =
                    editor.kind === "edit"
                      ? await updateSkillAction(editor.skill.id, input)
                      : await createSkillAction(input);
                  upsertLocal(row);
                  setEditor({ kind: "closed" });
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Could not save skill.",
                  );
                }
              });
            }}
          />
        ) : null}
      </section>

      <PublishedSkillsSection
        pending={pending}
        onError={setError}
        onInstalled={(row) => {
          upsertLocal(row);
        }}
        startTransition={startTransition}
      />
    </div>
  );
}

function SkillEditor({
  skill,
  pending,
  onCancel,
  onSave,
}: {
  readonly skill: UserSkill | null;
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onSave: (input: {
    title: string;
    slug: string;
    description: string;
    markdown: string;
    enabled: boolean;
  }) => void;
}) {
  const [title, setTitle] = useState(skill?.title ?? "");
  const [slug, setSlug] = useState(skill?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(skill));
  const [description, setDescription] = useState(skill?.description ?? "");
  const [markdown, setMarkdown] = useState(skill?.markdown ?? "");
  const [enabled, setEnabled] = useState(skill?.enabled ?? true);

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border bg-card p-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ title, slug, description, markdown, enabled });
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">
          {skill ? "Edit skill" : "New skill"}
        </h3>
        <Button
          disabled={pending}
          onClick={onCancel}
          size="sm"
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Title
        <Input
          disabled={pending}
          onChange={(event) => {
            const next = event.target.value;
            setTitle(next);
            if (!slugTouched) {
              setSlug(slugFromTitle(next));
            }
          }}
          required
          value={title}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Slug
        <Input
          disabled={pending}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          }}
          pattern="[A-Za-z0-9][A-Za-z0-9._-]*"
          required
          value={slug}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Description
        <span className="font-normal text-muted-foreground">
          Routing hint Pearl sees every turn (max{" "}
          {String(MAX_SKILL_DESCRIPTION_LENGTH)} characters).
        </span>
        <Textarea
          className="min-h-20"
          disabled={pending}
          maxLength={MAX_SKILL_DESCRIPTION_LENGTH}
          onChange={(event) => setDescription(event.target.value)}
          required
          value={description}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Body
        <span className="font-normal text-muted-foreground">
          Loaded only when Pearl activates the skill (max{" "}
          {String(MAX_CUSTOM_MARKDOWN_LENGTH)} characters for custom skills).
        </span>
        <Textarea
          className="min-h-48 font-mono text-xs"
          disabled={pending}
          onChange={(event) => setMarkdown(event.target.value)}
          required
          value={markdown}
        />
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input
          checked={enabled}
          disabled={pending}
          onChange={(event) => setEnabled(event.target.checked)}
          type="checkbox"
        />
        Enabled
      </label>
      {skill?.source === "registry" && Object.keys(skill.files ?? {}).length > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Package files ({Object.keys(skill.files).length}):{" "}
          {Object.keys(skill.files).sort().join(", ")}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button disabled={pending} size="sm" type="submit">
          {pending ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : null}
          Save
        </Button>
      </div>
    </form>
  );
}

function PublishedSkillsSection({
  pending,
  onError,
  onInstalled,
  startTransition,
}: {
  readonly pending: boolean;
  readonly onError: (message: string | null) => void;
  readonly onInstalled: (row: UserSkill) => void;
  readonly startTransition: (fn: () => Promise<void> | void) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly RegistrySearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [preview, setPreview] = useState<RegistrySkillPackage | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);

  const runSearch = () => {
    onError(null);
    setPreview(null);
    setSearching(true);
    void searchPublishedSkillsAction(query)
      .then((result) => setResults(result.items))
      .catch((cause: unknown) => {
        onError(
          cause instanceof Error ? cause.message : "Could not search skills.sh.",
        );
      })
      .finally(() => setSearching(false));
  };

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-medium">Add a published skill</h2>
        <p className="text-xs text-muted-foreground">
          Search the skills.sh catalog (including Vercel’s agent skills),
          preview the package, then install a copy for your account.
        </p>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          runSearch();
        }}
      >
        <Input
          disabled={searching || pending}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search skills.sh…"
          value={query}
        />
        <Button disabled={searching || pending} size="sm" type="submit">
          {searching ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <SearchIcon className="size-3.5" />
          )}
          Search
        </Button>
      </form>

      {results.length > 0 ? (
        <ul className="divide-y rounded-lg border bg-card">
          {results.map((item) => {
            const active = preview?.registryName === item.name;
            return (
              <li
                className={cn(
                  "flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start sm:justify-between",
                  active && "bg-muted/40",
                )}
                key={item.name}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{item.title}</div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {item.description || "No description."}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    {item.name}
                  </p>
                </div>
                <Button
                  disabled={pending || previewing === item.name}
                  onClick={() => {
                    onError(null);
                    setPreviewing(item.name);
                    void previewPublishedSkillAction(item.name)
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
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {previewing === item.name ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : null}
                  Preview
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {preview ? (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-medium">{preview.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {preview.description}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {preview.registryName}
                {preview.author ? ` · ${preview.author}` : ""}
              </p>
            </div>
            <Button
              disabled={pending}
              onClick={() => setPreview(null)}
              size="sm"
              type="button"
              variant="ghost"
            >
              Close
            </Button>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium">SKILL.md</div>
            <pre className="max-h-64 overflow-auto rounded-md border bg-muted/30 p-2 text-[11px] leading-relaxed whitespace-pre-wrap">
              {preview.markdown.slice(0, 8_000)}
              {preview.markdown.length > 8_000 ? "\n…" : ""}
            </pre>
          </div>
          {preview.filePaths.length > 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Extra files ({preview.filePaths.length}):{" "}
              {preview.filePaths.join(", ")}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button
              disabled={pending}
              onClick={() => {
                onError(null);
                startTransition(async () => {
                  try {
                    const row = await installPublishedSkillAction(
                      preview.registryName,
                    );
                    onInstalled(row);
                    setPreview(null);
                  } catch (cause) {
                    onError(
                      cause instanceof Error
                        ? cause.message
                        : "Could not install skill.",
                    );
                  }
                });
              }}
              size="sm"
              type="button"
            >
              {pending ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : null}
              Add to my skills
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
