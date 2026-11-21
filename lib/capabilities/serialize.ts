import type {
  Capability,
  CapabilityKind,
  CapabilityStatus,
} from "@/lib/db/schema";

export type CapabilityDto = {
  readonly id: string;
  readonly name: string;
  readonly kind: CapabilityKind;
  readonly summary: string;
  readonly audience: string | null;
  readonly proof: string | null;
  readonly status: CapabilityStatus;
  readonly projectId: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export function toCapabilityDto(row: Capability): CapabilityDto {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    summary: row.summary,
    audience: row.audience,
    proof: row.proof,
    status: row.status,
    projectId: row.projectId,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
