// Shape of eve's built-in `todo` tool (eve/tools/todo): a session list the
// model replaces wholesale. The chat UI reads the latest call on a message.

export const TODO_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export const TODO_PRIORITIES = ["high", "medium", "low"] as const;

export type TodoStatus = (typeof TODO_STATUSES)[number];
export type TodoPriority = (typeof TODO_PRIORITIES)[number];

export type AgentTodo = {
  readonly content: string;
  readonly status: TodoStatus;
  readonly priority: TodoPriority;
};

export type TodoSnapshot = {
  readonly items: readonly AgentTodo[];
  readonly updating: boolean;
};

type TodoToolPart = {
  readonly type?: string;
  readonly toolName?: string;
  readonly args?: unknown;
  /** Streaming JSON while `call.input` is still open. */
  readonly argsText?: string;
  readonly result?: unknown;
  readonly status?: { readonly type?: string };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStatus(value: unknown): value is TodoStatus {
  return (
    typeof value === "string" &&
    (TODO_STATUSES as readonly string[]).includes(value)
  );
}

function isPriority(value: unknown): value is TodoPriority {
  return (
    typeof value === "string" &&
    (TODO_PRIORITIES as readonly string[]).includes(value)
  );
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function todoFromRecord(entry: Record<string, unknown>): AgentTodo | null {
  if (typeof entry.content !== "string") return null;
  const content = entry.content.trim();
  if (!content || !isStatus(entry.status) || !isPriority(entry.priority)) {
    return null;
  }
  return { content, status: entry.status, priority: entry.priority };
}

/**
 * Recover complete todo objects from a truncated `argsText` stream. Stops at
 * the first incomplete object so partial trailing JSON never yields junk.
 */
function parsePartialTodosJson(text: string): AgentTodo[] {
  const marker = text.match(/"todos"\s*:\s*\[/);
  if (!marker || marker.index === undefined) return [];
  let cursor = marker.index + marker[0].length;
  const items: AgentTodo[] = [];

  while (cursor < text.length) {
    while (cursor < text.length && /[\s,]/.test(text[cursor]!)) cursor += 1;
    if (cursor >= text.length || text[cursor] === "]") break;
    if (text[cursor] !== "{") break;

    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;
    for (let i = cursor; i < text.length; i += 1) {
      const ch = text[i]!;
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) break;

    const parsed = parseJson(text.slice(cursor, end + 1));
    if (!isRecord(parsed)) break;
    const item = todoFromRecord(parsed);
    if (!item) break;
    items.push(item);
    cursor = end + 1;
  }

  return items;
}

/** Items from one tool payload. Accepts the args object, the result object, or a JSON string of either. */
export function parseAgentTodos(value: unknown): AgentTodo[] {
  if (typeof value === "string") {
    const full = parseJson(value);
    if (isRecord(full) && Array.isArray(full.todos)) {
      return parseAgentTodos(full);
    }
    return parsePartialTodosJson(value);
  }
  if (!isRecord(value) || !Array.isArray(value.todos)) return [];

  const items: AgentTodo[] = [];
  for (const entry of value.todos) {
    if (!isRecord(entry)) continue;
    const item = todoFromRecord(entry);
    if (item) items.push(item);
  }
  return items;
}

function itemsFromPart(part: TodoToolPart): AgentTodo[] {
  const fromResult = parseAgentTodos(part.result);
  if (fromResult.length > 0) return fromResult;
  const fromArgs = parseAgentTodos(part.args);
  if (fromArgs.length > 0) return fromArgs;
  // Prefer a complete-enough streaming payload over waiting for settle.
  if (typeof part.argsText === "string" && part.argsText.trim()) {
    return parseAgentTodos(part.argsText);
  }
  return [];
}

/**
 * The list as of the last `todo` call on this message. A later call replaces
 * the earlier one. A call still streaming with no items yet keeps the previous
 * list and sets `updating`.
 */
export function latestTodoSnapshot(
  parts: readonly TodoToolPart[],
): TodoSnapshot | null {
  let items: readonly AgentTodo[] | null = null;
  let saw = false;
  let updating = false;

  for (const part of parts) {
    if (part.type !== "tool-call" || part.toolName !== "todo") continue;
    saw = true;
    updating = part.status?.type === "running";
    const next = itemsFromPart(part);
    if (next.length > 0) items = next;
  }

  if (!saw || (!items && !updating)) return null;
  return { items: items ?? [], updating };
}

export function todoProgress(items: readonly AgentTodo[]): {
  readonly completed: number;
  readonly tracked: number;
} {
  let completed = 0;
  let cancelled = 0;
  for (const item of items) {
    if (item.status === "completed") completed += 1;
    else if (item.status === "cancelled") cancelled += 1;
  }
  return { completed, tracked: items.length - cancelled };
}
