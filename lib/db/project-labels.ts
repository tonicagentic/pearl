import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { getProject } from "@/lib/db/projects";
import {
  projectLabel,
  projectLabelAssignment,
  type ProjectLabel,
  type ProjectLabelColor,
} from "@/lib/db/schema";

const MAX_NAME = 40;

export const PROJECT_LABEL_COLORS = [
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
] as const satisfies readonly ProjectLabelColor[];

export type ProjectLabelDto = {
  readonly id: string;
  readonly name: string;
  readonly color: ProjectLabelColor;
  readonly createdAt: string;
};

function toDto(row: ProjectLabel): ProjectLabelDto {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.createdAt.toISOString(),
  };
}

function requireName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A label needs a name.");
  if (trimmed.length > MAX_NAME) {
    throw new Error(`Label names must be ${MAX_NAME} characters or fewer.`);
  }
  return trimmed;
}

function requireColor(value: string | undefined): ProjectLabelColor {
  if (value === undefined || value === "") return "gray";
  if ((PROJECT_LABEL_COLORS as readonly string[]).includes(value)) {
    return value as ProjectLabelColor;
  }
  throw new Error(
    `color must be one of: ${PROJECT_LABEL_COLORS.join(", ")}.`,
  );
}

export async function listProjectLabels(
  userId: string,
): Promise<readonly ProjectLabelDto[]> {
  const rows = await db
    .select()
    .from(projectLabel)
    .where(eq(projectLabel.userId, userId))
    .orderBy(asc(projectLabel.name));
  return rows.map(toDto);
}

export async function createProjectLabel(
  userId: string,
  input: {
    readonly name: string;
    readonly color?: string;
  },
): Promise<ProjectLabelDto> {
  const name = requireName(input.name);
  const color = requireColor(input.color);

  try {
    const [row] = await db
      .insert(projectLabel)
      .values({ userId, name, color })
      .returning();
    if (!row) throw new Error("Failed to create label.");
    return toDto(row);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    if (message.includes("idx_project_label_user_name")) {
      throw new Error("A label with that name already exists.");
    }
    throw cause;
  }
}

export async function deleteProjectLabel(
  userId: string,
  labelId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(projectLabel)
    .where(and(eq(projectLabel.id, labelId), eq(projectLabel.userId, userId)))
    .returning({ id: projectLabel.id });
  return deleted.length > 0;
}

export async function listLabelsForProject(
  userId: string,
  projectId: string,
): Promise<readonly ProjectLabelDto[]> {
  const rows = await db
    .select({ label: projectLabel })
    .from(projectLabelAssignment)
    .innerJoin(
      projectLabel,
      eq(projectLabelAssignment.labelId, projectLabel.id),
    )
    .where(
      and(
        eq(projectLabelAssignment.userId, userId),
        eq(projectLabelAssignment.projectId, projectId),
      ),
    )
    .orderBy(asc(projectLabel.name));
  return rows.map((row) => toDto(row.label));
}

/** Labels keyed by project id for a user's project list. */
export async function listLabelsForProjects(
  userId: string,
  projectIds: readonly string[],
): Promise<ReadonlyMap<string, readonly ProjectLabelDto[]>> {
  const map = new Map<string, ProjectLabelDto[]>();
  if (projectIds.length === 0) return map;

  const rows = await db
    .select({
      projectId: projectLabelAssignment.projectId,
      label: projectLabel,
    })
    .from(projectLabelAssignment)
    .innerJoin(
      projectLabel,
      eq(projectLabelAssignment.labelId, projectLabel.id),
    )
    .where(
      and(
        eq(projectLabelAssignment.userId, userId),
        inArray(projectLabelAssignment.projectId, [...projectIds]),
      ),
    )
    .orderBy(asc(projectLabel.name));

  for (const row of rows) {
    const list = map.get(row.projectId) ?? [];
    list.push(toDto(row.label));
    map.set(row.projectId, list);
  }
  return map;
}

export async function setProjectLabels(
  userId: string,
  projectId: string,
  labelIds: readonly string[],
): Promise<readonly ProjectLabelDto[] | null> {
  const owned = await getProject(userId, projectId);
  if (!owned) return null;

  const uniqueIds = [...new Set(labelIds.map((id) => id.trim()).filter(Boolean))];

  if (uniqueIds.length > 0) {
    const ownedLabels = await db
      .select({ id: projectLabel.id })
      .from(projectLabel)
      .where(
        and(
          eq(projectLabel.userId, userId),
          inArray(projectLabel.id, uniqueIds),
        ),
      );
    if (ownedLabels.length !== uniqueIds.length) {
      throw new Error("Unknown label.");
    }
  }

  await db
    .delete(projectLabelAssignment)
    .where(
      and(
        eq(projectLabelAssignment.userId, userId),
        eq(projectLabelAssignment.projectId, projectId),
      ),
    );

  if (uniqueIds.length > 0) {
    await db.insert(projectLabelAssignment).values(
      uniqueIds.map((labelId) => ({
        userId,
        projectId,
        labelId,
      })),
    );
  }

  return listLabelsForProject(userId, projectId);
}

export async function assignLabelToProject(
  userId: string,
  projectId: string,
  labelId: string,
): Promise<readonly ProjectLabelDto[] | null> {
  const owned = await getProject(userId, projectId);
  if (!owned) return null;

  const [label] = await db
    .select()
    .from(projectLabel)
    .where(and(eq(projectLabel.id, labelId), eq(projectLabel.userId, userId)))
    .limit(1);
  if (!label) throw new Error("Unknown label.");

  await db
    .insert(projectLabelAssignment)
    .values({ userId, projectId, labelId })
    .onConflictDoNothing({
      target: [
        projectLabelAssignment.projectId,
        projectLabelAssignment.labelId,
      ],
    });

  return listLabelsForProject(userId, projectId);
}

export async function unassignLabelFromProject(
  userId: string,
  projectId: string,
  labelId: string,
): Promise<readonly ProjectLabelDto[] | null> {
  const owned = await getProject(userId, projectId);
  if (!owned) return null;

  await db
    .delete(projectLabelAssignment)
    .where(
      and(
        eq(projectLabelAssignment.userId, userId),
        eq(projectLabelAssignment.projectId, projectId),
        eq(projectLabelAssignment.labelId, labelId),
      ),
    );

  return listLabelsForProject(userId, projectId);
}
