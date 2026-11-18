import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  createArea,
  createIssue,
  ensureDefaultAreas,
  findAreaByName,
} from "@/lib/db/issues";
import { getProject } from "@/lib/db/projects";
import {
  issue,
  taskList,
  taskListItem,
  type TaskList,
  type TaskListCadence,
  type TaskListItem,
} from "@/lib/db/schema";
import {
  isScheduleDue,
  LISTS_TIME_ZONE,
  shouldSkipSpawnItem,
  todayInTimeZone,
  weekdayInTimeZone,
  type ListSchedule,
} from "@/lib/lists/schedule";

const MAX_NAME = 120;
const MAX_TITLE = 200;
const MAX_NOTES = 4_000;

export type TaskListWithItems = TaskList & {
  readonly items: readonly TaskListItem[];
};

export type SpawnResult = {
  readonly created: number;
  readonly skipped: number;
  readonly issueIds: readonly string[];
};

function requireName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A list needs a name.");
  if (trimmed.length > MAX_NAME) {
    throw new Error(`List names must be ${MAX_NAME} characters or fewer.`);
  }
  return trimmed;
}

function requireTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("An item needs a title.");
  if (trimmed.length > MAX_TITLE) {
    throw new Error(`Item titles must be ${MAX_TITLE} characters or fewer.`);
  }
  return trimmed;
}

function normalizeNotes(notes: string | null | undefined): string | null {
  if (notes === undefined || notes === null) return null;
  const trimmed = notes.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_NOTES);
}

function normalizeSchedule(input: {
  readonly cadence?: TaskListCadence | null;
  readonly weekday?: number | null;
  readonly monthDay?: number | null;
}): {
  cadence: TaskListCadence | null;
  weekday: number | null;
  monthDay: number | null;
} {
  const cadence = input.cadence === undefined ? null : input.cadence;
  if (cadence === null) {
    return { cadence: null, weekday: null, monthDay: null };
  }

  if (cadence === "daily") {
    return { cadence: "daily", weekday: null, monthDay: null };
  }

  if (cadence === "weekly") {
    const weekday = input.weekday;
    if (
      typeof weekday !== "number" ||
      !Number.isInteger(weekday) ||
      weekday < 0 ||
      weekday > 6
    ) {
      throw new Error("Weekly lists need a weekday from 0 (Sunday) to 6 (Saturday).");
    }
    return { cadence: "weekly", weekday, monthDay: null };
  }

  if (cadence === "monthly") {
    const monthDay = input.monthDay;
    if (
      typeof monthDay !== "number" ||
      !Number.isInteger(monthDay) ||
      monthDay < 1 ||
      monthDay > 28
    ) {
      throw new Error("Monthly lists need a day from 1 to 28.");
    }
    return { cadence: "monthly", weekday: null, monthDay };
  }

  throw new Error("Unknown cadence.");
}

async function ownedProjectIdOrNull(
  userId: string,
  projectId: string | null | undefined,
): Promise<string | null | undefined> {
  if (projectId === undefined) return undefined;
  if (projectId === null || projectId === "") return null;
  const owned = await getProject(userId, projectId);
  if (!owned) throw new Error("Unknown project id.");
  return owned.id;
}

export async function listTaskLists(
  userId: string,
): Promise<readonly TaskListWithItems[]> {
  const lists = await db
    .select()
    .from(taskList)
    .where(eq(taskList.userId, userId))
    .orderBy(asc(taskList.name));

  if (lists.length === 0) return [];

  const items = await db
    .select()
    .from(taskListItem)
    .where(
      inArray(
        taskListItem.listId,
        lists.map((row) => row.id),
      ),
    )
    .orderBy(asc(taskListItem.sortIndex), asc(taskListItem.createdAt));

  const byList = new Map<string, TaskListItem[]>();
  for (const item of items) {
    const bucket = byList.get(item.listId) ?? [];
    bucket.push(item);
    byList.set(item.listId, bucket);
  }

  return lists.map((list) => ({
    ...list,
    items: byList.get(list.id) ?? [],
  }));
}

export async function getTaskList(
  userId: string,
  listId: string,
): Promise<TaskListWithItems | null> {
  const [list] = await db
    .select()
    .from(taskList)
    .where(and(eq(taskList.userId, userId), eq(taskList.id, listId)))
    .limit(1);

  if (!list) return null;

  const items = await db
    .select()
    .from(taskListItem)
    .where(eq(taskListItem.listId, list.id))
    .orderBy(asc(taskListItem.sortIndex), asc(taskListItem.createdAt));

  return { ...list, items };
}

export async function createTaskList(
  userId: string,
  input: {
    readonly name: string;
    readonly projectId?: string | null;
    readonly cadence?: TaskListCadence | null;
    readonly weekday?: number | null;
    readonly monthDay?: number | null;
  },
): Promise<TaskListWithItems> {
  const name = requireName(input.name);
  const schedule = normalizeSchedule(input);
  const projectId = (await ownedProjectIdOrNull(userId, input.projectId)) ?? null;

  const [row] = await db
    .insert(taskList)
    .values({
      userId,
      name,
      projectId,
      cadence: schedule.cadence,
      weekday: schedule.weekday,
      monthDay: schedule.monthDay,
    })
    .returning();

  if (!row) throw new Error("Failed to create list.");
  return { ...row, items: [] };
}

export async function updateTaskList(
  userId: string,
  listId: string,
  input: {
    readonly name?: string;
    readonly projectId?: string | null;
    readonly cadence?: TaskListCadence | null;
    readonly weekday?: number | null;
    readonly monthDay?: number | null;
  },
): Promise<TaskListWithItems> {
  const existing = await getTaskList(userId, listId);
  if (!existing) throw new Error("List not found.");

  const patch: {
    name?: string;
    projectId?: string | null;
    cadence?: TaskListCadence | null;
    weekday?: number | null;
    monthDay?: number | null;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (input.name !== undefined) {
    patch.name = requireName(input.name);
  }

  if (input.projectId !== undefined) {
    patch.projectId = (await ownedProjectIdOrNull(userId, input.projectId)) ?? null;
  }

  if (
    input.cadence !== undefined ||
    input.weekday !== undefined ||
    input.monthDay !== undefined
  ) {
    const schedule = normalizeSchedule({
      cadence: input.cadence !== undefined ? input.cadence : existing.cadence,
      weekday: input.weekday !== undefined ? input.weekday : existing.weekday,
      monthDay:
        input.monthDay !== undefined ? input.monthDay : existing.monthDay,
    });
    patch.cadence = schedule.cadence;
    patch.weekday = schedule.weekday;
    patch.monthDay = schedule.monthDay;
  }

  await db
    .update(taskList)
    .set(patch)
    .where(and(eq(taskList.userId, userId), eq(taskList.id, listId)));

  const updated = await getTaskList(userId, listId);
  if (!updated) throw new Error("List not found after update.");
  return updated;
}

export async function deleteTaskList(
  userId: string,
  listId: string,
): Promise<boolean> {
  const result = await db
    .delete(taskList)
    .where(and(eq(taskList.userId, userId), eq(taskList.id, listId)))
    .returning({ id: taskList.id });
  return result.length > 0;
}

export async function createTaskListItem(
  userId: string,
  listId: string,
  input: {
    readonly title: string;
    readonly notes?: string | null;
    readonly sortIndex?: number;
  },
): Promise<TaskListItem> {
  const list = await getTaskList(userId, listId);
  if (!list) throw new Error("List not found.");

  const title = requireTitle(input.title);
  const notes = normalizeNotes(input.notes);
  const sortIndex =
    typeof input.sortIndex === "number" && Number.isInteger(input.sortIndex)
      ? input.sortIndex
      : list.items.length === 0
        ? 0
        : Math.max(...list.items.map((item) => item.sortIndex)) + 1;

  const [row] = await db
    .insert(taskListItem)
    .values({
      listId,
      title,
      notes,
      sortIndex,
    })
    .returning();

  if (!row) throw new Error("Failed to create item.");

  await db
    .update(taskList)
    .set({ updatedAt: new Date() })
    .where(eq(taskList.id, listId));

  return row;
}

export async function updateTaskListItem(
  userId: string,
  listId: string,
  itemId: string,
  input: {
    readonly title?: string;
    readonly notes?: string | null;
    readonly checked?: boolean;
    readonly sortIndex?: number;
  },
): Promise<TaskListItem> {
  const list = await getTaskList(userId, listId);
  if (!list) throw new Error("List not found.");
  const existing = list.items.find((item) => item.id === itemId);
  if (!existing) throw new Error("Item not found.");

  const patch: {
    title?: string;
    notes?: string | null;
    checkedAt?: Date | null;
    sortIndex?: number;
  } = {};

  if (input.title !== undefined) {
    patch.title = requireTitle(input.title);
  }
  if (input.notes !== undefined) {
    patch.notes = normalizeNotes(input.notes);
  }
  if (input.checked === true) {
    patch.checkedAt = existing.checkedAt ?? new Date();
  } else if (input.checked === false) {
    patch.checkedAt = null;
  }
  if (
    typeof input.sortIndex === "number" &&
    Number.isInteger(input.sortIndex)
  ) {
    patch.sortIndex = input.sortIndex;
  }

  const [row] = await db
    .update(taskListItem)
    .set(patch)
    .where(and(eq(taskListItem.id, itemId), eq(taskListItem.listId, listId)))
    .returning();

  if (!row) throw new Error("Item not found.");

  await db
    .update(taskList)
    .set({ updatedAt: new Date() })
    .where(eq(taskList.id, listId));

  return row;
}

export async function deleteTaskListItem(
  userId: string,
  listId: string,
  itemId: string,
): Promise<boolean> {
  const list = await getTaskList(userId, listId);
  if (!list) throw new Error("List not found.");

  const result = await db
    .delete(taskListItem)
    .where(and(eq(taskListItem.id, itemId), eq(taskListItem.listId, listId)))
    .returning({ id: taskListItem.id });

  if (result.length > 0) {
    await db
      .update(taskList)
      .set({ updatedAt: new Date() })
      .where(eq(taskList.id, listId));
  }

  return result.length > 0;
}

export async function resetTaskListChecks(
  userId: string,
  listId: string,
): Promise<TaskListWithItems> {
  const list = await getTaskList(userId, listId);
  if (!list) throw new Error("List not found.");

  await db
    .update(taskListItem)
    .set({ checkedAt: null })
    .where(eq(taskListItem.listId, listId));

  await db
    .update(taskList)
    .set({ updatedAt: new Date() })
    .where(eq(taskList.id, listId));

  const updated = await getTaskList(userId, listId);
  if (!updated) throw new Error("List not found after reset.");
  return updated;
}

/**
 * Materialize each list item as an inbox issue for `occurrenceDate`.
 * Skips items that already have an open issue from this list, or that were
 * already spawned for this occurrence date.
 */
export async function spawnTaskList(
  userId: string,
  listId: string,
  occurrenceDate: string = todayInTimeZone(),
): Promise<SpawnResult> {
  const list = await getTaskList(userId, listId);
  if (!list) throw new Error("List not found.");

  await ensureDefaultAreas(userId);
  let inbox = await findAreaByName(userId, "Inbox");
  if (!inbox) {
    // ensureDefaultAreas should have created it; fall back to create.
    inbox = await createArea(userId, "Inbox");
  }

  const openFromList = await db
    .select({ listItemId: issue.listItemId })
    .from(issue)
    .where(
      and(
        eq(issue.userId, userId),
        eq(issue.listId, listId),
        eq(issue.status, "open"),
        isNotNull(issue.listItemId),
      ),
    );

  const openItemIds = new Set(
    openFromList
      .map((row) => row.listItemId)
      .filter((id): id is string => typeof id === "string"),
  );

  const alreadySpawned = await db
    .select({ listItemId: issue.listItemId })
    .from(issue)
    .where(
      and(
        eq(issue.userId, userId),
        eq(issue.listId, listId),
        eq(issue.listOccurrence, occurrenceDate),
        isNotNull(issue.listItemId),
      ),
    );

  const spawnedItemIds = new Set(
    alreadySpawned
      .map((row) => row.listItemId)
      .filter((id): id is string => typeof id === "string"),
  );

  let created = 0;
  let skipped = 0;
  const issueIds: string[] = [];

  for (const item of list.items) {
    if (shouldSkipSpawnItem(item.id, openItemIds, spawnedItemIds)) {
      skipped += 1;
      continue;
    }

    const createdIssue = await createIssue(userId, {
      title: item.title,
      description: item.notes,
      areaId: inbox.id,
      projectId: list.projectId,
      dueDate: occurrenceDate,
      listId: list.id,
      listItemId: item.id,
      listOccurrence: occurrenceDate,
    });

    created += 1;
    issueIds.push(createdIssue.id);
  }

  return { created, skipped, issueIds };
}

/** Spawn every scheduled list that is due for `userId` today. */
export async function spawnDueListsForUser(
  userId: string,
  now: Date = new Date(),
): Promise<{
  readonly lists: number;
  readonly created: number;
  readonly skipped: number;
}> {
  const today = todayInTimeZone(LISTS_TIME_ZONE, now);
  const weekday = weekdayInTimeZone(LISTS_TIME_ZONE, now);
  const lists = await listTaskLists(userId);

  let touched = 0;
  let created = 0;
  let skipped = 0;

  for (const list of lists) {
    const schedule: ListSchedule = {
      cadence: list.cadence,
      weekday: list.weekday,
      monthDay: list.monthDay,
    };
    if (!isScheduleDue(schedule, today, weekday)) continue;
    if (list.items.length === 0) continue;

    const result = await spawnTaskList(userId, list.id, today);
    touched += 1;
    created += result.created;
    skipped += result.skipped;
  }

  return { lists: touched, created, skipped };
}

/** Users who own at least one list with a non-null cadence. */
export async function listUserIdsWithScheduledLists(): Promise<
  readonly string[]
> {
  const rows = await db
    .selectDistinct({ userId: taskList.userId })
    .from(taskList)
    .where(isNotNull(taskList.cadence));
  return rows.map((row) => row.userId);
}

export function serializeTaskList(list: TaskListWithItems) {
  return {
    id: list.id,
    name: list.name,
    projectId: list.projectId,
    cadence: list.cadence,
    weekday: list.weekday,
    monthDay: list.monthDay,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
    items: list.items.map((item) => ({
      id: item.id,
      title: item.title,
      notes: item.notes,
      sortIndex: item.sortIndex,
      checkedAt: item.checkedAt ? item.checkedAt.toISOString() : null,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}
