/**
 * Shared coder task-card receipt: job stages while the child runs, and the
 * settled handoff (repo, PR, files, preview, recording) once report_handoff
 * lands on the child or on subagent.completed output.
 */

export type CoderHandoffFile = {
  readonly path: string;
  readonly additions: number;
  readonly deletions: number;
};

export type CoderHandoffRepo = {
  readonly owner: string;
  readonly name: string;
  readonly url: string;
  readonly branch?: string;
};

export type CoderHandoffPullRequest = {
  readonly url: string;
  readonly number: number;
  readonly title: string;
  readonly draft?: boolean;
};

export type CoderHandoffPreview = {
  readonly url: string;
  readonly httpStatus?: number | null;
  readonly authWall?: boolean;
  readonly screenshotUrl?: string;
};

export type CoderHandoffRecording = {
  readonly url: string;
  readonly posterUrl?: string;
  readonly durationMs?: number;
  readonly title?: string;
};

export type CoderHandoff = {
  readonly summary: string;
  readonly repo?: CoderHandoffRepo;
  readonly pullRequest?: CoderHandoffPullRequest;
  readonly files?: readonly CoderHandoffFile[];
  readonly preview?: CoderHandoffPreview;
  readonly recording?: CoderHandoffRecording;
};

export type CoderJobStage = {
  readonly name: string;
  readonly weight: number;
  readonly description?: string;
};

/** Fixed weighted stages for a coder run (checkout → preview). */
export const CODER_JOB_STAGES: readonly CoderJobStage[] = [
  { name: "checkout", weight: 1, description: "Fetching the branch" },
  { name: "edit", weight: 4, description: "Implementing the change" },
  { name: "checks", weight: 3, description: "Running the suite" },
  { name: "pull request", weight: 2, description: "Opening a draft PR" },
  { name: "preview", weight: 2, description: "Publishing a preview" },
];

export type CoderJobProgress = {
  readonly stageIndex: number;
  readonly stageProgress: number;
  readonly stages: readonly CoderJobStage[];
};

export type FileTreeNode = {
  readonly path: string;
  readonly name: string;
  readonly depth: number;
  readonly kind: "folder" | "file";
  readonly additions?: number;
  readonly deletions?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function parseRepo(value: unknown): CoderHandoffRepo | undefined {
  if (!isRecord(value)) return undefined;
  const owner = asString(value.owner);
  const name = asString(value.name);
  const url = asString(value.url);
  if (!owner || !name || !url) return undefined;
  return {
    owner,
    name,
    url,
    ...(asString(value.branch) ? { branch: asString(value.branch) } : {}),
  };
}

function parsePullRequest(
  value: unknown,
): CoderHandoffPullRequest | undefined {
  if (!isRecord(value)) return undefined;
  const url = asString(value.url);
  const number = asNumber(value.number);
  const title = asString(value.title);
  if (!url || number === undefined || !title) return undefined;
  return {
    url,
    number,
    title,
    ...(asBoolean(value.draft) !== undefined
      ? { draft: asBoolean(value.draft) }
      : {}),
  };
}

function parseFiles(value: unknown): readonly CoderHandoffFile[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const files: CoderHandoffFile[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const path = asString(item.path);
    const additions = asNumber(item.additions) ?? 0;
    const deletions = asNumber(item.deletions) ?? 0;
    if (!path) continue;
    files.push({ path, additions, deletions });
  }
  return files.length > 0 ? files : undefined;
}

function parsePreview(value: unknown): CoderHandoffPreview | undefined {
  if (!isRecord(value)) return undefined;
  const url = asString(value.url);
  if (!url) return undefined;
  return {
    url,
    ...(value.httpStatus === null || asNumber(value.httpStatus) !== undefined
      ? { httpStatus: value.httpStatus === null ? null : asNumber(value.httpStatus) }
      : {}),
    ...(asBoolean(value.authWall) !== undefined
      ? { authWall: asBoolean(value.authWall) }
      : {}),
    ...(asString(value.screenshotUrl)
      ? { screenshotUrl: asString(value.screenshotUrl) }
      : {}),
  };
}

function parseRecording(value: unknown): CoderHandoffRecording | undefined {
  if (!isRecord(value)) return undefined;
  const url = asString(value.url);
  if (!url) return undefined;
  return {
    url,
    ...(asString(value.posterUrl) ? { posterUrl: asString(value.posterUrl) } : {}),
    ...(asNumber(value.durationMs)
      ? { durationMs: asNumber(value.durationMs) }
      : {}),
    ...(asString(value.title) ? { title: asString(value.title) } : {}),
  };
}

/** Normalize a tool result or completion payload into a CoderHandoff. */
export function parseCoderHandoff(value: unknown): CoderHandoff | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.startsWith("{")) return null;
    try {
      return parseCoderHandoff(JSON.parse(trimmed) as unknown);
    } catch {
      return null;
    }
  }
  if (!isRecord(value)) return null;

  // report_handoff tool result: { status, handoff }
  if (isRecord(value.handoff)) {
    const nested = parseCoderHandoff(value.handoff);
    if (nested) return nested;
  }

  // Completion payload: { summary, handoff } or the handoff fields at the root.
  const root = isRecord(value.handoff) ? value.handoff : value;
  if (!isRecord(root)) return null;
  const summary =
    asString(root.summary) ??
    asString(value.summary) ??
    "";
  const repo = parseRepo(root.repo);
  const pullRequest = parsePullRequest(root.pullRequest);
  const files = parseFiles(root.files);
  const preview = parsePreview(root.preview);
  const recording = parseRecording(root.recording);

  const hasBody =
    Boolean(repo) ||
    Boolean(pullRequest) ||
    Boolean(files?.length) ||
    Boolean(preview) ||
    Boolean(recording);
  if (!summary && !hasBody) return null;

  return {
    summary: summary || "Coder finished.",
    ...(repo ? { repo } : {}),
    ...(pullRequest ? { pullRequest } : {}),
    ...(files ? { files } : {}),
    ...(preview ? { preview } : {}),
    ...(recording ? { recording } : {}),
  };
}

/**
 * Prefer the live child `report_handoff` tool result; fall back to the
 * completed run's output so a reopened thread still shows the receipt.
 */
export function extractCoderHandoff(input: {
  readonly runResult?: unknown;
  readonly childMessages?: readonly {
    readonly parts?: readonly {
      readonly type?: string;
      readonly name?: string;
      readonly state?: string;
      readonly output?: unknown;
    }[];
  }[];
}): CoderHandoff | null {
  const messages = input.childMessages ?? [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const parts = messages[i]?.parts ?? [];
    for (let j = parts.length - 1; j >= 0; j -= 1) {
      const part = parts[j];
      if (
        part?.type === "tool" &&
        part.name === "report_handoff" &&
        part.state === "completed"
      ) {
        const handoff = parseCoderHandoff(part.output);
        if (handoff) return handoff;
      }
    }
  }
  return parseCoderHandoff(input.runResult);
}

type ToolNameHint = {
  readonly name?: string;
  readonly input?: unknown;
};

function toolHintsFromMessages(
  messages: readonly {
    readonly parts?: readonly {
      readonly type?: string;
      readonly name?: string;
      readonly input?: unknown;
      readonly state?: string;
    }[];
  }[],
): ToolNameHint[] {
  const hints: ToolNameHint[] = [];
  for (const message of messages) {
    for (const part of message.parts ?? []) {
      if (part.type !== "tool" || !part.name) continue;
      hints.push({ name: part.name, input: part.input });
    }
  }
  return hints;
}

function stageIndexForTool(hint: ToolNameHint): number {
  const name = (hint.name ?? "").toLowerCase();
  const input = isRecord(hint.input) ? hint.input : {};
  const command =
    (asString(input.command) ?? asString(input.cmd) ?? "").toLowerCase();

  if (
    name === "preview_check" ||
    name === "publish_dev_server" ||
    name === "deploy_vercel" ||
    name === "expo_simulator" ||
    name === "deployment_logs" ||
    name === "report_handoff"
  ) {
    return 4;
  }
  if (
    name === "gated_git" ||
    name.includes("pr") ||
    /\bgh\s+pr\b/.test(command) ||
    /pr create/.test(command)
  ) {
    if (/\bpr\b/.test(command) || name.includes("pr") || name === "gated_git") {
      // gated_git also covers first push — treat push as checks/PR boundary.
      if (/git push/.test(command) && !/\bpr\b/.test(command)) return 3;
      return 3;
    }
  }
  if (
    name === "bash" ||
    name === "run_with_env" ||
    /pnpm|npm|yarn|bun|vitest|jest|playwright|tsc|lint|typecheck|test/.test(
      command,
    )
  ) {
    if (
      /pnpm|npm|yarn|bun|vitest|jest|playwright|tsc|lint|typecheck|test|build/.test(
        command,
      )
    ) {
      return 2;
    }
  }
  if (
    name.includes("write") ||
    name.includes("edit") ||
    name === "glob" ||
    name === "grep" ||
    name.startsWith("code__")
  ) {
    return 1;
  }
  if (
    name.includes("git") ||
    name === "bash" ||
    /git clone|git checkout|git fetch|git pull|gh repo clone/.test(command)
  ) {
    if (/git clone|git checkout|git fetch|git pull|gh repo clone/.test(command)) {
      return 0;
    }
  }
  return -1;
}

/**
 * Map followed child tool names onto CODER_JOB_STAGES. Returns progress for
 * the current (latest highest) stage; stageProgress stays mid-stage while
 * tools are still arriving.
 */
export function deriveCoderJobProgress(
  childMessages: readonly {
    readonly parts?: readonly {
      readonly type?: string;
      readonly name?: string;
      readonly input?: unknown;
      readonly state?: string;
    }[];
  }[] = [],
  previewLine?: string | null,
): CoderJobProgress {
  const hints = toolHintsFromMessages(childMessages);
  let stageIndex = 0;
  for (const hint of hints) {
    const next = stageIndexForTool(hint);
    if (next > stageIndex) stageIndex = next;
  }
  if (hints.length === 0) stageIndex = 0;

  const stages = CODER_JOB_STAGES.map((stage, index) =>
    index === stageIndex && previewLine
      ? { ...stage, description: previewLine }
      : stage,
  );

  // Mid-stage while tools are still landing; last stage starts higher once
  // preview tools appear.
  const stageProgress =
    stageIndex >= CODER_JOB_STAGES.length - 1 ? 0.55 : 0.35;

  return { stageIndex, stageProgress, stages };
}

/** Flat file list → folder headers + indented file rows for FileTree. */
export function buildCoderFileTree(
  files: readonly CoderHandoffFile[],
): {
  readonly nodes: readonly FileTreeNode[];
  readonly totalAdditions: number;
  readonly totalDeletions: number;
} {
  const nodes: FileTreeNode[] = [];
  const seenDirs = new Set<string>();
  let totalAdditions = 0;
  let totalDeletions = 0;

  for (const file of files) {
    totalAdditions += file.additions;
    totalDeletions += file.deletions;
    const slash = file.path.lastIndexOf("/");
    const dir = slash === -1 ? "" : file.path.slice(0, slash);
    const name = slash === -1 ? file.path : file.path.slice(slash + 1);

    if (dir && !seenDirs.has(dir)) {
      seenDirs.add(dir);
      nodes.push({ path: dir, name: dir, depth: 0, kind: "folder" });
    }

    nodes.push({
      path: file.path,
      name,
      depth: dir ? 1 : 0,
      kind: "file",
      additions: file.additions || undefined,
      deletions: file.deletions || undefined,
    });
  }

  return { nodes, totalAdditions, totalDeletions };
}
