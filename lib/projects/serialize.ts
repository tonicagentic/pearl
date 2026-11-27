import type { ProjectLabelDto } from "@/lib/db/project-labels";
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
  /** Shared Vercel Drive for project sandboxes; null until first provision. */
  readonly driveName: string | null;
  readonly labels: readonly ProjectLabelDto[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export function serializeProject(
  row: Project,
  labels: readonly ProjectLabelDto[] = [],
): SerializedProject {
  return {
    id: row.id,
    name: row.name,
    instructions: row.instructions,
    status: row.status,
    priority: row.priority,
    startDate: row.startDate,
    targetDate: row.targetDate,
    driveName: row.driveName ?? null,
    labels,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
