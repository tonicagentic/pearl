import type {
  Project,
  ProjectPriority,
  ProjectStatus,
} from "@/lib/db/schema";

export type SerializedProject = {
  readonly id: string;
  readonly name: string;
  readonly instructions: string;
  readonly status: ProjectStatus;
  readonly priority: ProjectPriority;
  readonly startDate: string | null;
  readonly targetDate: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export function serializeProject(row: Project): SerializedProject {
  return {
    id: row.id,
    name: row.name,
    instructions: row.instructions,
    status: row.status,
    priority: row.priority,
    startDate: row.startDate,
    targetDate: row.targetDate,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
