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

/** Items from one tool payload. Accepts the args object, the result object, or a JSON string of either. */
export function parseAgentTodos(value: unknown): AgentTodo[] {
  const record = typeof value === "string" ? parseJson(value) : value;
  if (!isRecord(record) || !Array.isArray(record.todos)) return [];

  const items: AgentTodo[] = [];
  for (const entry of record.todos) {
    if (!isRecord(entry)) continue;
    if (typeof entry.content !== "string") continue;
    const content = entry.content.trim();
    if (!content || !isStatus(entry.status) || !isPriority(entry.priority)) {
      continue;
    }
    items.push({ content, status: entry.status, priority: entry.priority });
  }
  return items;
}

function itemsFromPart(part: TodoToolPart): AgentTodo[] {
  const fromResult = parseAgentTodos(part.result);
  if (fromResult.length > 0) return fromResult;
  return parseAgentTodos(part.args);
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
