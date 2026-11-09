import assert from "node:assert/strict";
import { test } from "node:test";

import {
  latestTodoSnapshot,
  parseAgentTodos,
  todoProgress,
} from "../lib/agent-todos.ts";

const tokyo = {
  content: "Check Tokyo",
  status: "completed",
  priority: "high",
} as const;

const paris = {
  content: "Check Paris",
  status: "in_progress",
  priority: "medium",
} as const;

test("parseAgentTodos reads a result object and ignores incomplete items", () => {
  assert.deepEqual(
    parseAgentTodos({
      counts: { total: 2 },
      todos: [tokyo, { content: "  ", status: "pending", priority: "low" }, { content: "Nope" }],
    }),
    [tokyo],
  );
  assert.deepEqual(parseAgentTodos(JSON.stringify({ todos: [paris] })), [paris]);
  assert.deepEqual(parseAgentTodos({}), []);
  assert.deepEqual(parseAgentTodos("not json"), []);
});

test("latestTodoSnapshot keeps the last full list and flags a streaming rewrite", () => {
  assert.equal(latestTodoSnapshot([]), null);
  assert.deepEqual(
    latestTodoSnapshot([
      {
        type: "tool-call",
        toolName: "todo",
        args: { todos: [tokyo] },
        status: { type: "complete" },
      },
      {
        type: "tool-call",
        toolName: "todo",
        args: { todos: [tokyo, paris] },
        result: { todos: [tokyo, paris] },
        status: { type: "complete" },
      },
    ]),
    { items: [tokyo, paris], updating: false },
  );
  assert.deepEqual(
    latestTodoSnapshot([
      {
        type: "tool-call",
        toolName: "todo",
        result: { todos: [paris] },
        status: { type: "complete" },
      },
      {
        type: "tool-call",
        toolName: "todo",
        args: {},
        status: { type: "running" },
      },
    ]),
    { items: [paris], updating: true },
  );
});

test("todoProgress ignores cancelled items", () => {
  assert.deepEqual(
    todoProgress([
      tokyo,
      paris,
      { content: "Skip", status: "cancelled", priority: "low" },
    ]),
    { completed: 1, tracked: 2 },
  );
});
