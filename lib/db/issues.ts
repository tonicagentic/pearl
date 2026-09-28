import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { issue, responsibility, user } from "@/lib/db/schema";
import type { Responsibility } from "@/lib/db/schema";

export type ResponsibilityNode = Responsibility & {
  readonly children: ResponsibilityNode[];
};

export type ResponsibilityOption = {
  readonly id: string;
  readonly label: string;
};

/**
 * Flatten the tree into indented select options for the issue forms. Runs on
 * the server; the options array crosses to the client components as a plain
 * serializable prop.
 */
export function flattenResponsibilityOptions(
  tree: readonly ResponsibilityNode[],
): ResponsibilityOption[] {
  const options: ResponsibilityOption[] = [];

  for (const node of tree) {
    for (const [id, label] of walk(node, 0)) {
      options.push({ id, label });
    }
  }

  return options;
}

function* walk(
  node: ResponsibilityNode,
  depth: number,
): Generator<readonly [string, string]> {
  yield [node.id, `${" ".repeat(depth * 2)}${node.name}`] as const;

  for (const child of node.children) {
    yield* walk(child, depth + 1);
  }
}

/**
 * Make sure a `user` row exists for this session principal, so issue and
 * responsibility rows can satisfy their foreign keys. Real better-auth
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
// the responsibilities page (root((Responsibilities))).
type DefaultResponsibility = {
  readonly name: string;
  readonly children?: readonly DefaultResponsibility[];
};

const DEFAULT_RESPONSIBILITIES: readonly DefaultResponsibility[] = [
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
  nodes: readonly DefaultResponsibility[],
  parentId: string | null,
  startIndex: number,
) {
  for (const [index, node] of nodes.entries()) {
    // Conflict-safe: concurrent seeds (or a retry after a crash) no-op on the
    // sibling-name unique index instead of duplicating the tree.
    const [row] = await db
      .insert(responsibility)
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

/** Idempotently seed the default responsibility tree; runs once per user. */
export async function ensureDefaultResponsibilities(userId: string) {
  const existing = await db
    .select({ id: responsibility.id })
    .from(responsibility)
    .where(eq(responsibility.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    return;
  }

  await seedTree(userId, DEFAULT_RESPONSIBILITIES, null, 0);
}

export async function listResponsibilities(
  userId: string,
): Promise<ResponsibilityNode[]> {
  const rows = await db
    .select()
    .from(responsibility)
    .where(eq(responsibility.userId, userId))
    .orderBy(asc(responsibility.sortIndex), asc(responsibility.createdAt));

  const byId = new Map<string, ResponsibilityNode>(
    rows.map((row) => [row.id, { ...row, children: [] }]),
  );
  const roots: ResponsibilityNode[] = [];

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

export async function getResponsibility(
  userId: string,
  id: string,
): Promise<Responsibility | null> {
  const [row] = await db
    .select()
    .from(responsibility)
    .where(and(eq(responsibility.userId, userId), eq(responsibility.id, id)))
    .limit(1);

  return row ?? null;
}

export async function findResponsibilityByName(
  userId: string,
  name: string,
): Promise<Responsibility | null> {
  const [row] = await db
    .select()
    .from(responsibility)
    .where(
      and(
        eq(responsibility.userId, userId),
        sql`lower(${responsibility.name}) = lower(${name})`,
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function createResponsibility(
  userId: string,
  name: string,
  parentId?: string | null,
  sortIndex?: number,
): Promise<Responsibility> {
  const [row] = await db
    .insert(responsibility)
    .values({ userId, name, parentId: parentId ?? null, sortIndex: sortIndex ?? 0 })
    .returning();

  if (!row) {
    throw new Error("Failed to create responsibility.");
  }

  return row;
}

export async function renameResponsibility(
  userId: string,
  id: string,
  name: string,
) {
  await db
    .update(responsibility)
    .set({ name })
    .where(and(eq(responsibility.userId, userId), eq(responsibility.id, id)));
}

/**
 * Delete a responsibility subtree. Refuses while any issue in the subtree is
 * open — resolve or re-parent them first — so a delete can never silently
 * discard unresolved open loops. Returns the number of blocked open issues.
 */
export async function deleteResponsibilityIfSettled(
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
        inArray(issue.responsibilityId, subtreeIds),
      ),
    );

  const blocked = openIssues[0]?.count ?? 0;

  if (blocked > 0) {
    return { deleted: false, openIssues: blocked };
  }

  await db
    .delete(responsibility)
    .where(
      and(
        eq(responsibility.userId, userId),
        inArray(responsibility.id, subtreeIds),
      ),
    );

  return { deleted: true };
}

async function collectSubtreeIds(userId: string, rootId: string) {
  const rows = await db
    .select({ id: responsibility.id, parentId: responsibility.parentId })
    .from(responsibility)
    .where(eq(responsibility.userId, userId));

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

export type IssueWithResponsibility = {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: "open" | "resolved";
  readonly dueDate: string | null;
  readonly reviewDate: string | null;
  readonly createdAt: Date;
  readonly resolvedAt: Date | null;
  readonly responsibilityId: string;
  readonly responsibilityName: string;
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
  responsibilityId: issue.responsibilityId,
  responsibilityName: responsibility.name,
};

export async function listOpenIssues(
  userId: string,
): Promise<IssueWithResponsibility[]> {
  return db
    .select(issueSelection)
    .from(issue)
    .innerJoin(responsibility, eq(issue.responsibilityId, responsibility.id))
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
): Promise<IssueWithResponsibility[]> {
  return db
    .select(issueSelection)
    .from(issue)
    .innerJoin(responsibility, eq(issue.responsibilityId, responsibility.id))
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
): Promise<IssueWithResponsibility | null> {
  const [row] = await db
    .select(issueSelection)
    .from(issue)
    .innerJoin(responsibility, eq(issue.responsibilityId, responsibility.id))
    .where(and(eq(issue.userId, userId), eq(issue.id, id)))
    .limit(1);

  return row ?? null;
}

export type CreateIssueInput = {
  readonly title: string;
  readonly description?: string | null;
  readonly responsibilityId: string;
  readonly dueDate?: string | null;
  readonly reviewDate?: string | null;
};

export async function createIssue(
  userId: string,
  input: CreateIssueInput,
): Promise<IssueWithResponsibility> {
  const [row] = await db
    .insert(issue)
    .values({
      userId,
      title: input.title,
      description: input.description ?? null,
      responsibilityId: input.responsibilityId,
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
  readonly responsibilityId?: string;
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
      ...(input.responsibilityId !== undefined
        ? { responsibilityId: input.responsibilityId }
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
