import type {
  CapabilityKind,
  CapabilityStatus,
} from "@/lib/db/schema";

export const CAPABILITY_KINDS = [
  "skill",
  "product",
  "service",
] as const satisfies readonly CapabilityKind[];

export const CAPABILITY_STATUSES = [
  "active",
  "exploring",
  "archived",
] as const satisfies readonly CapabilityStatus[];

export const MAX_CAPABILITY_NAME_LENGTH = 120;
export const MAX_CAPABILITY_SUMMARY_LENGTH = 400;
export const MAX_CAPABILITY_AUDIENCE_LENGTH = 400;
export const MAX_CAPABILITY_PROOF_LENGTH = 1000;
export const MAX_CAPABILITY_NOTES_LENGTH = 2000;

/** Cap how many active capabilities appear in the per-turn instruction index. */
export const MAX_CAPABILITY_INDEX_ENTRIES = 20;

export type CapabilityFormInput = {
  readonly name?: string | null;
  readonly kind?: CapabilityKind | null;
  readonly summary?: string | null;
  readonly audience?: string | null;
  readonly proof?: string | null;
  readonly status?: CapabilityStatus | null;
  readonly projectId?: string | null;
  readonly notes?: string | null;
};

export class CapabilityInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapabilityInputError";
  }
}

function isKind(value: unknown): value is CapabilityKind {
  return (
    typeof value === "string" &&
    (CAPABILITY_KINDS as readonly string[]).includes(value)
  );
}

function isStatus(value: unknown): value is CapabilityStatus {
  return (
    typeof value === "string" &&
    (CAPABILITY_STATUSES as readonly string[]).includes(value)
  );
}

function trimOrNull(
  value: string | null | undefined,
  max: number,
  label: string,
): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) {
    throw new CapabilityInputError(
      `${label} must be at most ${String(max)} characters.`,
    );
  }
  return trimmed;
}

function requireTrimmed(
  value: string | null | undefined,
  max: number,
  label: string,
): string {
  const trimmed = trimOrNull(value, max, label);
  if (!trimmed) {
    throw new CapabilityInputError(`${label} is required.`);
  }
  return trimmed;
}

/**
 * Normalize a create or full-update payload. Name, kind, and summary are
 * required. Empty optional strings become null.
 */
export function normalizeCapabilityInput(input: {
  readonly name: string;
  readonly kind: CapabilityKind;
  readonly summary: string;
  readonly audience?: string | null;
  readonly proof?: string | null;
  readonly status?: CapabilityStatus | null;
  readonly projectId?: string | null;
  readonly notes?: string | null;
}): {
  readonly name: string;
  readonly kind: CapabilityKind;
  readonly summary: string;
  readonly audience: string | null;
  readonly proof: string | null;
  readonly status: CapabilityStatus;
  readonly projectId: string | null;
  readonly notes: string | null;
} {
  if (!isKind(input.kind)) {
    throw new CapabilityInputError(
      "Kind must be skill, product, or service.",
    );
  }
  const status = input.status ?? "active";
  if (!isStatus(status)) {
    throw new CapabilityInputError(
      "Status must be active, exploring, or archived.",
    );
  }

  const projectId =
    input.projectId === undefined || input.projectId === null
      ? null
      : input.projectId.trim() || null;

  return {
    name: requireTrimmed(input.name, MAX_CAPABILITY_NAME_LENGTH, "Name"),
    kind: input.kind,
    summary: requireTrimmed(
      input.summary,
      MAX_CAPABILITY_SUMMARY_LENGTH,
      "Summary",
    ),
    audience: trimOrNull(
      input.audience,
      MAX_CAPABILITY_AUDIENCE_LENGTH,
      "Audience",
    ),
    proof: trimOrNull(input.proof, MAX_CAPABILITY_PROOF_LENGTH, "Proof"),
    status,
    projectId,
    notes: trimOrNull(input.notes, MAX_CAPABILITY_NOTES_LENGTH, "Notes"),
  };
}

/**
 * Merge a partial patch onto an existing row. Explicit null clears optional
 * fields; omitted keys keep the stored value.
 */
export function mergeCapabilityInput(
  base: {
    readonly name: string;
    readonly kind: CapabilityKind;
    readonly summary: string;
    readonly audience: string | null;
    readonly proof: string | null;
    readonly status: CapabilityStatus;
    readonly projectId: string | null;
    readonly notes: string | null;
  },
  patch: CapabilityFormInput,
): ReturnType<typeof normalizeCapabilityInput> {
  return normalizeCapabilityInput({
    name: patch.name !== undefined && patch.name !== null ? patch.name : base.name,
    kind:
      patch.kind !== undefined && patch.kind !== null ? patch.kind : base.kind,
    summary:
      patch.summary !== undefined && patch.summary !== null
        ? patch.summary
        : base.summary,
    audience:
      patch.audience !== undefined ? patch.audience : base.audience,
    proof: patch.proof !== undefined ? patch.proof : base.proof,
    status:
      patch.status !== undefined && patch.status !== null
        ? patch.status
        : base.status,
    projectId:
      patch.projectId !== undefined ? patch.projectId : base.projectId,
    notes: patch.notes !== undefined ? patch.notes : base.notes,
  });
}

export function parseCapabilityKind(value: unknown): CapabilityKind | null {
  return isKind(value) ? value : null;
}

export function parseCapabilityStatus(
  value: unknown,
): CapabilityStatus | null {
  return isStatus(value) ? value : null;
}
