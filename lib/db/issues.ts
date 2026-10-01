import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { issue, area, user } from "@/lib/db/schema";
import type { Area } from "@/lib/db/schema";

export type AreaNode = Area & {
  readonly children: AreaNode[];
};

export type AreaOption = {
  readonly id: string;
  readonly label: string;
};

/**
 * Flatten the tree into indented select options for the issue forms. Runs on
 * the server; the options array crosses to the client components as a plain
 * serializable prop.
 */
export function flattenAreaOptions(
  tree: readonly AreaNode[],
): AreaOption[] {
  const options: AreaOption[] = [];

  for (const node of tree) {
    for (const [id, label] of walk(node, 0)) {
      options.push({ id, label });
    }
  }

  return options;
}

function* walk(
  node: AreaNode,
  depth: number,
): Generator<readonly [string, string]> {
  yield [node.id, `${" ".repeat(depth * 2)}${node.name}`] as const;

  for (const child of node.children) {
    yield* walk(child, depth + 1);
  }
}

/**
 * Make sure a `user` row exists for this session principal, so issue and
 * area rows can satisfy their foreign keys. Real better-auth
 * sessions already have one; the local-dev/password principal
 * (`eve-chat-user`) does not — insert it lazily, once, no-op on conflict.
 */
export async function ensureUserForPrincipal(principal: {
  readonly principalId: string;
  readonly attributes: Readonly<Record<string, string | readonly string[]>>;
}) {
  await db
    .insert(user)
    .values({
      id: principal.principalId,
      name:
        (typeof principal.attributes.name === "string"
          ? principal.attributes.name
          : undefined) ?? "Pearl user",
      email:
        (typeof principal.attributes.email === "string"
          ? principal.attributes.email
          : undefined) ?? `${principal.principalId}@users.pearl.local`,
    })
    .onConflictDoNothing();
}

// The default stewardship tree seeded for every new user: stable areas of
// life, never completed. Issues attach to these. Rendered as a mind map on
// the areas page (root((Areas))).
type DefaultArea = {
  readonly name: string;
  readonly children?: readonly DefaultArea[];
};

const DEFAULT_AREAS: readonly DefaultArea[] = [
  { name: "Body", children: [{ name: "Aesthetics" }, { name: "Physical health" }] },
  { name: "Mind", children: [{ name: "Learning" }, { name: "Reflection" }, { name: "Comfort" }] },
  { name: "Career", children: [{ name: "Tonic Agentic" }, { name: "Personal brand" }] },
  { name: "People", children: [{ name: "Family" }, { name: "Friends" }, { name: "Intimacy" }, { name: "Community" }] },
  { name: "Home", children: [{ name: "San Francisco" }, { name: "Boulder" }] },
  {
    name: "Finances",
    children: [
      { name: "Taxes" },
      { name: "Investments" },
      { name: "Cash flow" },
      { name: "Insurance" },
    ],
  },
  {
    name: "Activity",
    children: [
      { name: "Travel" },
      {
        name: "Creative",
        children: [{ name: "Music" }, { name: "Design engineering" }, { name: "Architecture" }],
      },
      {
        name: "Outdoors",
        children: [{ name: "Surfing" }, { name: "Snowboarding" }, { name: "Hiking" }],
      },
    ],
  },
];

async function seedTree(
  userId: string,
  nodes: readonly DefaultArea[],
  parentId: string | null,
  startIndex: number,
) {
  for (const [index, node] of nodes.entries()) {
    // Conflict-safe: concurrent seeds (or a retry after a crash) no-op on the
    // sibling-name unique index instead of duplicating the tree.
    const [row] = await db
      .insert(area)
      .values({
        userId,
        name: node.name,
        parentId,
        sortIndex: startIndex + index,
      })
      .onConflictDoNothing()
      .returning();

    if (!row) {
      continue;
    }

    if (node.children?.length) {
      await seedTree(userId, node.children, row.id, 0);
    }
  }
}

/** Idempotently seed the default area tree; runs once per user. */
export async function ensureDefaultAreas(userId: string) {
  const existing = await db
    .select({ id: area.id })
    .from(area)
    .where(eq(area.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    return;
  }

  await seedTree(userId, DEFAULT_AREAS, null, 0);
}

export async function listAreas(
  userId: string,
): Promise<AreaNode[]> {
  const rows = await db
    .select()
    .from(area)
    .where(eq(area.userId, userId))
    .orderBy(asc(area.sortIndex), asc(area.createdAt));

  const byId = new Map<string, AreaNode>(
    rows.map((row) => [row.id, { ...row, children: [] }]),
  );
  const roots: AreaNode[] = [];

  for (const row of rows) {
    const node = byId.get(row.id);
    if (!node) {
      continue;
    }

    if (row.parentId === null) {
      roots.push(node);
    } else {
      byId.get(row.parentId)?.children.push(node);
    }
  }

  return roots;
}

export async function getArea(
  userId: string,
  id: string,
): Promise<Area | null> {
  const [row] = await db
    .select()
    .from(area)
    .where(and(eq(area.userId, userId), eq(area.id, id)))
    .limit(1);

  return row ?? null;
}

export async function findAreaByName(
  userId: string,
  name: string,
): Promise<Area | null> {
  const [row] = await db
    .select()
    .from(area)
    .where(
      and(
        eq(area.userId, userId),
        sql`lower(${area.name}) = lower(${name})`,
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function createArea(
  userId: string,
  name: string,
  parentId?: string | null,
  sortIndex?: number,
): Promise<Area> {
  const [row] = await db
    .insert(area)
    .values({ userId, name, parentId: parentId ?? null, sortIndex: sortIndex ?? 0 })
    .returning();

  if (!row) {
    throw new Error("Failed to create area.");
  }

  return row;
}

export async function renameArea(
  userId: string,
  id: string,
  name: string,
) {
  await db
    .update(area)
    .set({ name })
    .where(and(eq(area.userId, userId), eq(area.id, id)));
}

/**
 * Move an area under a new parent (or to the top level) at a sibling
 * position. Refuses to move a subtree under itself. Sorts the area to the
 * end of its new siblings then renumbers both old and new sibling groups,
 * so concurrent moves cannot interleave the ordering.
 */
export async function moveArea(
  userId: string,
  id: string,
  parentId: string | null,
  sortIndex: number,
) {
  if (parentId) {
    const parent = await getArea(userId, parentId);
    if (!parent) {
      throw new Error("The parent area does not exist.");
    }
    // Walk up from the new parent; landing inside the moved subtree would
    // create a cycle in the self-referencing tree.
    let cursor = parent;
    while (cursor.parentId) {
      if (cursor.parentId === id) {
        throw new Error("An area cannot be moved under its own subtree.");
      }
      const next = await getArea(userId, cursor.parentId);
      if (!next) {
        break;
      }
      cursor = next;
    }
  }

  const moved = await getArea(userId, id);
  if (!moved) {
    throw new Error("The area does not exist.");
  }

  const maxIndex = await db
    .select({ max: sql<number>`coalesce(max(${area.sortIndex}), -1)::int` })
    .from(area)
    .where(
      parentId === null
        ? and(eq(area.userId, userId), isNull(area.parentId))
        : and(eq(area.userId, userId), eq(area.parentId, parentId)),
    );
  const targetIndex = Math.max(
    0,
    Math.min(sortIndex, (maxIndex[0]?.max ?? -1) + 1),
  );

  await db
    .update(area)
    .set({ parentId, sortIndex: targetIndex })
    .where(and(eq(area.userId, userId), eq(area.id, id)));

  // Renumber the siblings of both the old and new parent groups.
  for (const parentIdValue of [moved.parentId, parentId]) {
    const siblings = await db
      .select({ id: area.id, sortIndex: area.sortIndex })
      .from(area)
      .where(
        parentIdValue === null
          ? and(eq(area.userId, userId), isNull(area.parentId))
          : and(eq(area.userId, userId), eq(area.parentId, parentIdValue)),
      )
      .orderBy(asc(area.sortIndex), asc(area.createdAt));
    for (const [index, sibling] of siblings.entries()) {
      if (sibling.sortIndex !== index) {
        await db
          .update(area)
          .set({ sortIndex: index })
          .where(and(eq(area.userId, userId), eq(area.id, sibling.id)));
      }
    }
  }
}

/**
 * Delete a area subtree. Refuses while any issue in the subtree is
 * open — resolve or re-parent them first — so a delete can never silently
 * discard unresolved open loops. Returns the number of blocked open issues.
 */
export async function deleteAreaIfSettled(
  userId: string,
  id: string,
): Promise<{ deleted: true } | { deleted: false; openIssues: number }> {
  const subtreeIds = await collectSubtreeIds(userId, id);

  const openIssues = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(issue)
    .where(
      and(
        eq(issue.userId, userId),
        eq(issue.status, "open"),
        inArray(issue.areaId, subtreeIds),
      ),
    );

  const blocked = openIssues[0]?.count ?? 0;

  if (blocked > 0) {
    return { deleted: false, openIssues: blocked };
  }

  await db
    .delete(area)
    .where(
      and(
        eq(area.userId, userId),
        inArray(area.id, subtreeIds),
      ),
    );

  return { deleted: true };
}

async function collectSubtreeIds(userId: string, rootId: string) {
  const rows = await db
    .select({ id: area.id, parentId: area.parentId })
    .from(area)
    .where(eq(area.userId, userId));

  const childrenByParent = new Map<string, string[]>();

  for (const row of rows) {
    if (row.parentId === null) {
      continue;
    }

    childrenByParent.set(row.parentId, [
      ...(childrenByParent.get(row.parentId) ?? []),
      row.id,
    ]);
  }

  const ids = [rootId];

  for (let index = 0; index < ids.length; index++) {
    for (const child of childrenByParent.get(ids[index]) ?? []) {
      ids.push(child);
    }
  }

  return ids;
}

export type IssueWithArea = {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: "open" | "resolved";
  readonly dueDate: string | null;
  readonly reviewDate: string | null;
  readonly createdAt: Date;
  readonly resolvedAt: Date | null;
  readonly areaId: string;
  readonly areaName: string;
};

const issueSelection = {
  id: issue.id,
  title: issue.title,
  description: issue.description,
  status: issue.status,
  dueDate: issue.dueDate,
  reviewDate: issue.reviewDate,
  createdAt: issue.createdAt,
  resolvedAt: issue.resolvedAt,
  areaId: issue.areaId,
  areaName: area.name,
};

export async function listOpenIssues(
  userId: string,
): Promise<IssueWithArea[]> {
  return db
    .select(issueSelection)
    .from(issue)
    .innerJoin(area, eq(issue.areaId, area.id))
    .where(and(eq(issue.userId, userId), eq(issue.status, "open")))
    .orderBy(
      asc(sql`coalesce(${issue.reviewDate}, ${issue.dueDate})`),
      asc(issue.dueDate),
      asc(issue.createdAt),
    );
}

export async function listRecentlyResolvedIssues(
  userId: string,
  sinceIso: string,
): Promise<IssueWithArea[]> {
  return db
    .select(issueSelection)
    .from(issue)
    .innerJoin(area, eq(issue.areaId, area.id))
    .where(
      and(
        eq(issue.userId, userId),
        eq(issue.status, "resolved"),
        sql`${issue.resolvedAt} >= ${sinceIso}::timestamptz`,
      ),
    )
    .orderBy(asc(issue.resolvedAt))
    .limit(20);
}

export async function getIssue(
  userId: string,
  id: string,
): Promise<IssueWithArea | null> {
  const [row] = await db
    .select(issueSelection)
    .from(issue)
    .innerJoin(area, eq(issue.areaId, area.id))
    .where(and(eq(issue.userId, userId), eq(issue.id, id)))
    .limit(1);

  return row ?? null;
}

export type CreateIssueInput = {
  readonly title: string;
  readonly description?: string | null;
  readonly areaId: string;
  readonly dueDate?: string | null;
  readonly reviewDate?: string | null;
};

export async function createIssue(
  userId: string,
  input: CreateIssueInput,
): Promise<IssueWithArea> {
  const [row] = await db
    .insert(issue)
    .values({
      userId,
      title: input.title,
      description: input.description ?? null,
      areaId: input.areaId,
      dueDate: input.dueDate ?? null,
      reviewDate: input.reviewDate ?? null,
    })
    .returning({ id: issue.id });

  if (!row) {
    throw new Error("Failed to create issue.");
  }

  const created = await getIssue(userId, row.id);

  if (!created) {
    throw new Error("Failed to load created issue.");
  }

  return created;
}

export type UpdateIssueInput = {
  readonly title?: string;
  readonly description?: string | null;
  readonly areaId?: string;
  readonly dueDate?: string | null;
  readonly reviewDate?: string | null;
};

export async function updateIssue(
  userId: string,
  id: string,
  input: UpdateIssueInput,
) {
  await db
    .update(issue)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.areaId !== undefined
        ? { areaId: input.areaId }
        : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
      ...(input.reviewDate !== undefined
        ? { reviewDate: input.reviewDate }
        : {}),
    })
    .where(and(eq(issue.userId, userId), eq(issue.id, id)));
}

export async function resolveIssue(userId: string, id: string) {
  await db
    .update(issue)
    .set({ status: "resolved", resolvedAt: new Date() })
    .where(
      and(eq(issue.userId, userId), eq(issue.id, id), isNull(issue.resolvedAt)),
    );
}

export async function reopenIssue(userId: string, id: string) {
  await db
    .update(issue)
    .set({ status: "open", resolvedAt: null })
    .where(and(eq(issue.userId, userId), eq(issue.id, id)));
}
