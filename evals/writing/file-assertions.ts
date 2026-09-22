// Shared assertions for the file-artifact contract: written works (blog
// posts, essays, multi-paragraph drafts) are delivered as canvas files via
// write_file, revised with targeted edit_file spans, and the chat thread
// stays short — critique and decisions, not the prose itself
// (docs/writing-enhancement-plan.md, Phase 2).

type ToolCallLike = {
  readonly name: string;
  readonly status?: string;
  readonly input?: unknown;
};

type TurnLike = {
  readonly toolCalls: readonly ToolCallLike[];
  readonly message?: string | null;
};

type WriteFileInput = { content?: string };
type EditFileInput = { oldText?: string; newText?: string };

function completedCalls(turn: TurnLike, name: string): ToolCallLike[] {
  return turn.toolCalls.filter(
    (call) =>
      call.name === name &&
      (call.status === undefined || call.status === "completed"),
  );
}

// The artifact as the agent left it: every write_file provides base content,
// and every edit_file's replacement is applied in order. `base` seeds content
// written in an earlier turn (so a follow-up edit turn can be graded on the
// full artifact). Returns the joined reconstruction — the material the judge
// grades and the anti-flooding check compares against.
export function artifactMaterial(turn: TurnLike, base = ""): string {
  // File semantics, not append semantics: a write_file REPLACES the content
  // at its path (the authored tool keeps the path stable across revisions),
  // and an edit_file patches the file it names. Multiple files in one turn
  // are tracked separately and joined for grading.
  type WriteFileInputWithPath = WriteFileInput & { filePath?: string };
  type EditFileInputWithPath = EditFileInput & { filePath?: string };

  const files = new Map<string, string>();
  if (base.length > 0) files.set("__seed__", base);
  let lastKey = base.length > 0 ? "__seed__" : undefined;

  for (const call of completedCalls(turn, "write_file")) {
    const input = call.input as WriteFileInputWithPath | undefined;
    if (typeof input?.content === "string" && input.content.length > 0) {
      const path =
        typeof input.filePath === "string" && input.filePath.length > 0
          ? input.filePath
          : "__unpathed__";
      files.set(path, input.content);
      lastKey = path;
    }
  }

  for (const call of completedCalls(turn, "edit_file")) {
    const input = call.input as EditFileInputWithPath | undefined;
    const oldText = typeof input?.oldText === "string" ? input.oldText : "";
    const newText = typeof input?.newText === "string" ? input.newText : "";
    if (oldText.length === 0 && newText.length === 0) continue;
    const path =
      typeof input?.filePath === "string" ? input.filePath : undefined;
    // Patch the named file when tracked; otherwise patch the most recent
    // material (the seeded base, or the last write).
    const key = path !== undefined && files.has(path) ? path : lastKey;
    if (key === undefined) continue;
    const current = files.get(key) ?? "";
    if (oldText.length > 0 && current.includes(oldText)) {
      files.set(key, current.replace(oldText, () => newText));
    } else if (newText.length > 0) {
      files.set(key, current.length > 0 ? `${current}\n\n${newText}` : newText);
    }
  }

  return [...files.values()]
    .filter((content) => content.length > 0)
    .join("\n\n");
}

// The thread must not carry the artifact: the reply does not re-paste the
// file's opening verbatim. A full draft (or full edited version) pasted into
// the chat is exactly the flooding this contract forbids, while a one-line
// note on a short file stays fine.
export function threadDoesNotRepeatArtifact(
  turn: TurnLike,
  artifact: string,
): boolean {
  const message = turn.message ?? "";
  const window = Math.min(120, Math.floor(artifact.length / 2));
  if (window < 20) {
    return true;
  }
  return !message.includes(artifact.slice(0, window));
}

// The agent used a targeted edit (edit_file) rather than re-emitting the
// whole file for a discrete change.
export function usedTargetedEdit(turn: TurnLike): boolean {
  return completedCalls(turn, "edit_file").length > 0;
}
