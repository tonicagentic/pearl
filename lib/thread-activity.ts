/**
 * Thread activity verbs — one tense rule for web and mobile timelines.
 *
 * A step that is still running uses the present participle. A finished step
 * uses the simple past. The same stem is used in both tenses. `Thought` and
 * `Thinking` name a reasoning block; they never name a turn that also used
 * tools.
 *
 * Collapsed header:
 * - Live: lead with the trailing step’s participle and target, then finished
 *   counts (Edited, Explored, Searched, Ran). Do not count the in-flight call.
 * - Settled: past tense only. Duration is a suffix (`· 12s`), never the word
 *   Thought and never “Worked for”.
 * - First clause capitalized; later clauses lowercased.
 *
 * Line diffs (`+N −N`) use line counts. The header shows the group total when
 * the group has edits; each edit row shows that edit’s own counts. There is
 * no footer that says Editing again.
 *
 * One speaker at a time: the timeline owns the line once it has a live
 * trailing segment. The bottom status line speaks only for pre-content, person
 * waits, stalls, and uncovered tools (write_file, etc.).
 */

export type ActivityStatusType =
  | "running"
  | "complete"
  | "incomplete"
  | "requires-action"
  | string;

export type ActivityToolPart = {
  readonly type: "tool-call";
  readonly toolName: string;
  readonly args?: unknown;
  /** Streaming JSON text while `call.input` is still open (`args` may be empty). */
  readonly argsText?: string;
  /** Live activity text from tool `label` / `call.progress`. */
  readonly label?: string;
  readonly result?: unknown;
  readonly status?: { readonly type?: ActivityStatusType };
};

export type ActivityReasoningPart = {
  readonly type: "reasoning";
  readonly text?: string;
};

export type ActivityPart = ActivityToolPart | ActivityReasoningPart;

export type ActivityBit = {
  readonly verb: string;
  readonly detail: string;
};

export type ActivityStep = {
  readonly verb: string;
  readonly chip: string;
  readonly detail?: string;
  readonly filePath?: string;
  readonly added?: number;
  readonly removed?: number;
  readonly kind?: "skill";
  readonly failed?: boolean;
};

export type ActivityHeader = {
  readonly bits: readonly ActivityBit[];
  /** Flat sentence for shimmer / string headers (no duration). */
  readonly text: string;
  readonly added?: number;
  readonly removed?: number;
};

type VerbPair = {
  readonly live: string;
  readonly settled: string;
  readonly infinitive: string;
};

const VERB_PAIRS: Record<string, VerbPair> = {
  read_file: { live: "Reading", settled: "Read", infinitive: "read" },
  read_attachment: { live: "Reading", settled: "Read", infinitive: "read" },
  glob: { live: "Listing", settled: "Listed", infinitive: "list" },
  list_issues: { live: "Listing", settled: "Listed", infinitive: "list" },
  list_expo_projects: { live: "Listing", settled: "Listed", infinitive: "list" },
  grep: { live: "Searching", settled: "Searched", infinitive: "search" },
  web_search: { live: "Searching", settled: "Searched", infinitive: "search" },
  web_fetch: { live: "Opening", settled: "Opened", infinitive: "open" },
  deployment_logs: { live: "Opening", settled: "Opened", infinitive: "open" },
  browser: { live: "Browsing", settled: "Browsed", infinitive: "browse" },
  exa_agent_run: {
    live: "Researching",
    settled: "Researched",
    infinitive: "research",
  },
  bash: { live: "Running", settled: "Ran", infinitive: "run" },
  run_with_env: { live: "Running", settled: "Ran", infinitive: "run" },
  edit_file: { live: "Editing", settled: "Edited", infinitive: "edit" },
  write_file: { live: "Writing", settled: "Wrote", infinitive: "write" },
  generate_svg: { live: "Writing", settled: "Wrote", infinitive: "write" },
  load_skill: { live: "Loading", settled: "Loaded", infinitive: "load" },
  get_profile: { live: "Loading", settled: "Loaded", infinitive: "load" },
  file__save_memory: {
    live: "Remembering",
    settled: "Remembered",
    infinitive: "remember",
  },
  file__remove_memory: {
    live: "Forgetting",
    settled: "Forgot",
    infinitive: "forget",
  },
  get_weather: { live: "Checking", settled: "Checked", infinitive: "check" },
  preview_check: { live: "Checking", settled: "Checked", infinitive: "check" },
  send_notification: {
    live: "Notifying",
    settled: "Notified",
    infinitive: "notify",
  },
  task_cancel: { live: "Cancelling", settled: "Cancelled", infinitive: "cancel" },
  deploy_vercel: { live: "Deploying", settled: "Deployed", infinitive: "deploy" },
  merge_pr: { live: "Merging", settled: "Merged", infinitive: "merge" },
  build_run: { live: "Starting", settled: "Started", infinitive: "start" },
  simulator_start: { live: "Starting", settled: "Started", infinitive: "start" },
  build_submit: {
    live: "Submitting",
    settled: "Submitted",
    infinitive: "submit",
  },
  pin_expo_preview: { live: "Pinning", settled: "Pinned", infinitive: "pin" },
  create_issue: { live: "Creating", settled: "Created", infinitive: "create" },
  resolve_issue: {
    live: "Resolving",
    settled: "Resolved",
    infinitive: "resolve",
  },
};

const DEFAULT_CHIPS: Record<string, string> = {
  get_profile: "profile",
  build_run: "EAS build",
  build_submit: "EAS submit",
  simulator_start: "Expo simulator",
  pin_expo_preview: "Expo preview",
  list_expo_projects: "Expo projects",
  preview_check: "preview",
  deployment_logs: "logs",
  deploy_vercel: "Vercel",
  merge_pr: "pull request",
  get_weather: "weather",
};

const EXPLORED_TOOLS = new Set([
  "read_file",
  "glob",
  "read_attachment",
]);
const SEARCHED_TOOLS = new Set(["grep", "web_search", "exa_agent_run"]);
const RAN_TOOLS = new Set(["bash", "run_with_env"]);

export function humanizeToolName(toolName: string): string {
  const bare = toolName.includes("__")
    ? (toolName.split("__").pop() ?? toolName)
    : toolName;
  const spaced = bare.replace(/[_-]+/g, " ").trim();
  if (!spaced) return toolName;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function basename(path: string): string {
  return path.split("/").pop() || path;
}

export function lineCount(text: string | undefined): number | undefined {
  if (text === undefined) return undefined;
  if (text.length === 0) return 0;
  return text.split("\n").length;
}

function siteChip(raw: string): string {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
    if (!path) return host;
    const clipped =
      path.length > 48 ? `${path.slice(0, 45).replace(/\/?$/, "")}…` : path;
    return `${host}${clipped}`;
  } catch {
    return "";
  }
}

function pairFor(toolName: string): VerbPair {
  return (
    VERB_PAIRS[toolName] ?? {
      live: "Using",
      settled: "Used",
      infinitive: "use",
    }
  );
}

const PARTIAL_ARG_KEYS = [
  "filePath",
  "query",
  "pattern",
  "command",
  "url",
  "skill",
  "recipient",
  "title",
  "name",
  "attachmentId",
  "taskId",
  "message",
] as const;

/** Best-effort string field extract from partial JSON while args stream. */
export function extractPartialArgString(
  argsText: string | undefined,
  key: string,
): string | undefined {
  if (!argsText || !key) return undefined;
  const pattern = new RegExp(
    `"${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)(?:"|$)`,
  );
  const match = argsText.match(pattern);
  if (!match?.[1]) return undefined;
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return match[1];
  }
}

function partialArgsFromText(
  argsText: string | undefined,
): Record<string, string> {
  if (!argsText) return {};
  const out: Record<string, string> = {};
  for (const key of PARTIAL_ARG_KEYS) {
    const value = extractPartialArgString(argsText, key);
    if (value) out[key] = value;
  }
  return out;
}

function argsOf(part: ActivityToolPart): Record<string, unknown> {
  const base =
    part.args && typeof part.args === "object" && !Array.isArray(part.args)
      ? (part.args as Record<string, unknown>)
      : {};
  if (Object.keys(base).length > 0) return base;
  return partialArgsFromText(part.argsText);
}

/** `L85–104` when offset/limit describe a span; empty otherwise. */
export function lineSpanLabel(args: Record<string, unknown>): string {
  const limit =
    typeof args.limit === "number" && Number.isFinite(args.limit)
      ? Math.trunc(args.limit)
      : undefined;
  const offset =
    typeof args.offset === "number" && Number.isFinite(args.offset)
      ? Math.trunc(args.offset)
      : undefined;
  if (limit === undefined || limit < 1) return "";
  const start = offset !== undefined && offset >= 1 ? offset : 1;
  const end = start + limit - 1;
  return `L${start}–${end}`;
}

export function chipForTool(part: ActivityToolPart): string {
  const args = argsOf(part);
  if (part.toolName === "get_profile") return DEFAULT_CHIPS.get_profile;
  if (typeof args.filePath === "string") {
    const name = basename(args.filePath);
    if (part.toolName === "read_file") {
      const span = lineSpanLabel(args);
      return span ? `${name} ${span}` : name;
    }
    return name;
  }
  if (typeof args.command === "string") {
    return args.command.split("\n")[0]!.slice(0, 200);
  }
  if (typeof args.pattern === "string") return args.pattern;
  if (typeof args.query === "string") return args.query;
  if (typeof args.skill === "string") return args.skill;
  if (typeof args.recipient === "string") return args.recipient;
  if (typeof args.attachmentId === "string") return args.attachmentId;
  if (typeof args.taskId === "string") return args.taskId;
  if (typeof args.url === "string") {
    const site = siteChip(args.url);
    if (site) return site;
  }
  if (typeof args.message === "string") {
    return args.message.split("\n")[0]!.slice(0, 200);
  }
  if (typeof args.title === "string") return args.title;
  if (typeof args.name === "string") return args.name;
  const preset = DEFAULT_CHIPS[part.toolName];
  if (preset) return preset;
  return humanizeToolName(part.toolName);
}

export function isToolFailed(part: ActivityToolPart): boolean {
  if (part.status?.type === "running") return false;
  if (part.status?.type === "incomplete") return true;
  const result = part.result;
  return (
    result !== undefined &&
    typeof result === "object" &&
    result !== null &&
    "error" in result
  );
}

function editDiff(part: ActivityToolPart): {
  added?: number;
  removed?: number;
} {
  const args = argsOf(part);
  return {
    added: lineCount(
      typeof args.newText === "string" ? args.newText : undefined,
    ),
    removed: lineCount(
      typeof args.oldText === "string" ? args.oldText : undefined,
    ),
  };
}

function filePathOf(part: ActivityToolPart): string | undefined {
  const args = argsOf(part);
  return typeof args.filePath === "string" ? args.filePath : undefined;
}

/**
 * One timeline row. Pass `live: true` only for the trailing step of a live
 * segment — earlier rows stay past tense.
 */
export function toActivityStep(
  part: ActivityPart,
  options: { readonly live?: boolean } = {},
): ActivityStep {
  if (part.type === "reasoning") {
    return {
      verb: options.live ? "Thinking" : "Thought",
      chip: "",
      detail: part.text,
    };
  }

  const chip = chipForTool(part).slice(0, 200);
  const path = filePathOf(part);
  const pair = pairFor(part.toolName);
  const failed = !options.live && isToolFailed(part);

  if (failed) {
    const step: ActivityStep = {
      verb: `Couldn't ${pair.infinitive}`,
      chip,
      filePath: path,
      failed: true,
      kind: part.toolName === "load_skill" ? "skill" : undefined,
    };
    if (part.toolName === "load_skill") {
      const error =
        part.result !== undefined &&
        typeof part.result === "object" &&
        part.result !== null &&
        "error" in (part.result as object)
          ? String((part.result as { error?: unknown }).error ?? "Could not load skill")
          : "Could not load skill";
      return { ...step, detail: error };
    }
    return step;
  }

  const verb = options.live ? pair.live : pair.settled;
  if (part.toolName === "edit_file") {
    const diff = editDiff(part);
    return {
      verb,
      chip,
      filePath: path,
      added: diff.added,
      removed: diff.removed,
    };
  }

  if (part.toolName === "load_skill") {
    const skillName =
      typeof argsOf(part).skill === "string" &&
      String(argsOf(part).skill).trim()
        ? String(argsOf(part).skill).trim()
        : chip;
    return {
      verb,
      chip: skillName.slice(0, 200),
      detail: options.live ? undefined : `Loaded ${skillName}`,
      kind: "skill",
      filePath: path,
    };
  }

  return {
    verb,
    chip,
    filePath: path,
  };
}

type FinishedSummary = {
  readonly edited: number;
  readonly explored: number;
  readonly searched: number;
  readonly ran: number;
  readonly lastEditFile?: string;
  readonly editFiles: readonly string[];
  readonly added: number;
  readonly removed: number;
};

function summarizeTools(
  parts: readonly ActivityToolPart[],
): FinishedSummary {
  let edited = 0;
  let explored = 0;
  let searched = 0;
  let ran = 0;
  let lastEditFile: string | undefined;
  const editFiles: string[] = [];
  let added = 0;
  let removed = 0;

  for (const part of parts) {
    if (EXPLORED_TOOLS.has(part.toolName)) explored += 1;
    else if (SEARCHED_TOOLS.has(part.toolName)) searched += 1;
    else if (RAN_TOOLS.has(part.toolName)) ran += 1;
    else if (part.toolName === "edit_file") {
      edited += 1;
      const path = filePathOf(part);
      const name = path ? basename(path) : chipForTool(part);
      editFiles.push(name);
      lastEditFile = name;
      const diff = editDiff(part);
      added += diff.added ?? 0;
      removed += diff.removed ?? 0;
    }
  }

  return {
    edited,
    explored,
    searched,
    ran,
    lastEditFile,
    editFiles,
    added,
    removed,
  };
}

function pushBit(
  bits: ActivityBit[],
  verb: string,
  detail: string,
): void {
  bits.push({
    verb: bits.length === 0 ? verb : verb.toLowerCase(),
    detail,
  });
}

function pushEditedBit(
  bits: ActivityBit[],
  summary: Pick<FinishedSummary, "edited" | "lastEditFile" | "editFiles">,
): void {
  if (summary.edited <= 0) return;
  if (summary.edited === 1 && summary.lastEditFile) {
    pushBit(bits, "Edited", summary.lastEditFile);
    return;
  }
  pushBit(
    bits,
    "Edited",
    `${summary.edited} file${summary.edited === 1 ? "" : "s"}`,
  );
}

function pushRollupBits(
  bits: ActivityBit[],
  summary: FinishedSummary,
): void {
  pushEditedBit(bits, summary);
  if (summary.explored > 0) {
    pushBit(
      bits,
      "Explored",
      `${summary.explored} file${summary.explored === 1 ? "" : "s"}`,
    );
  }
  if (summary.searched > 0) {
    pushBit(
      bits,
      "Searched",
      `${summary.searched} time${summary.searched === 1 ? "" : "s"}`,
    );
  }
  if (summary.ran > 0) {
    pushBit(
      bits,
      "Ran",
      `${summary.ran} command${summary.ran === 1 ? "" : "s"}`,
    );
  }
}

function bitsToText(bits: readonly ActivityBit[]): string {
  return bits
    .map((bit) => (bit.detail ? `${bit.verb} ${bit.detail}` : bit.verb))
    .join(", ");
}

function groupDiff(parts: readonly ActivityPart[]): {
  added?: number;
  removed?: number;
} {
  let added = 0;
  let removed = 0;
  let any = false;
  for (const part of parts) {
    if (part.type !== "tool-call" || part.toolName !== "edit_file") continue;
    any = true;
    const diff = editDiff(part);
    added += diff.added ?? 0;
    removed += diff.removed ?? 0;
  }
  if (!any) return {};
  return {
    added: added > 0 ? added : undefined,
    removed: removed > 0 ? removed : undefined,
  };
}

function fallbackStepPhrase(
  part: ActivityPart,
  live: boolean,
): ActivityBit[] {
  const step = toActivityStep(part, { live });
  return [
    {
      verb: step.verb,
      detail: step.chip,
    },
  ];
}

/**
 * Collapsed header sentence for a timeline segment.
 * Duration is applied by the UI (`· 12s`); do not put Thought or Worked for here.
 */
export function composeActivityHeader(
  parts: readonly ActivityPart[],
  options: { readonly live?: boolean } = {},
): ActivityHeader {
  const live = options.live === true;
  if (parts.length === 0) {
    return { bits: [{ verb: live ? "Thinking" : "Thought", detail: "" }], text: live ? "Thinking" : "Thought" };
  }

  const tools = parts.filter(
    (part): part is ActivityToolPart => part.type === "tool-call",
  );
  const onlyReasoning = tools.length === 0;
  const diff = groupDiff(parts);

  if (onlyReasoning) {
    const bits: ActivityBit[] = [
      { verb: live ? "Thinking" : "Thought", detail: "" },
    ];
    return { bits, text: bitsToText(bits).trim(), ...diff };
  }

  const finishedTools = live ? tools.slice(0, -1) : tools;
  // When the live trailing part is reasoning, every tool is finished.
  const trailing = parts[parts.length - 1]!;
  const finishedForCounts =
    live && trailing.type === "reasoning" ? tools : finishedTools;
  const summary = summarizeTools(finishedForCounts);

  const bits: ActivityBit[] = [];

  if (live) {
    const lead = toActivityStep(trailing, { live: true });
    pushBit(bits, lead.verb, lead.chip);
    // finishedForCounts already drops the in-flight call, so completed edits
    // still appear after an Editing lead.
    pushRollupBits(bits, summary);
  } else {
    pushRollupBits(bits, summary);
  }

  if (bits.length === 0) {
    const phrase = fallbackStepPhrase(trailing, live);
    return {
      bits: phrase,
      text: bitsToText(phrase).trim(),
      ...diff,
    };
  }

  return {
    bits,
    text: bitsToText(bits).trim(),
    ...diff,
  };
}

/** Status-line label for an uncovered tool (write_file, etc.). */
export function statusLabelForTool(
  part: ActivityToolPart,
  options: { readonly live?: boolean } = {},
): string {
  const customLabel =
    typeof part.label === "string" ? part.label.trim() : "";
  if (
    customLabel &&
    customLabel.toLowerCase() !== humanizeToolName(part.toolName).toLowerCase()
  ) {
    return customLabel;
  }
  const step = toActivityStep(part, { live: options.live ?? true });
  return step.chip ? `${step.verb} ${step.chip}` : step.verb;
}

/** Hide settled duration below this — short turns read as noise. */
export const SETTLED_DURATION_MIN_MS = 3_000;

/** Visible duration phrase for collapsed timeline chrome (leads the summary). */
export function formatWorkedFor(elapsed: string): string {
  return `Worked for ${elapsed}`;
}

/** Prepend a worked-for duration when present. */
export function withElapsed(label: string, elapsed?: string): string {
  if (!elapsed) return label;
  return `${formatWorkedFor(elapsed)} · ${label}`;
}
