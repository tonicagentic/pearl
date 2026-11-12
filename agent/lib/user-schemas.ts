import {
  createConceptSchema,
  getConceptSchemaBySlug,
  retireConceptSchema,
  searchConceptSchemas,
  updateConceptSchema,
} from "@/lib/db/concept-schemas";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import type { ConceptSchema } from "@/lib/db/schema";
import {
  schemaBodiesEqual,
  validateSchemaDraft,
  type SchemaDraft,
} from "@/lib/schemas/validation";

/**
 * Structural subset of eve's session principal for schema tools.
 */
export type SchemaPrincipal =
  | {
      readonly principalId: string;
      readonly principalType: string;
      readonly attributes?: Readonly<Record<string, string | readonly string[]>>;
    }
  | null
  | undefined;

export function requireUserPrincipal(principal: SchemaPrincipal): {
  readonly principalId: string;
  readonly attributes: Readonly<Record<string, string | readonly string[]>>;
} {
  if (principal?.principalType !== "user" || !principal.principalId) {
    throw new Error("Sign in to manage schemas.");
  }
  return {
    principalId: principal.principalId,
    attributes: principal.attributes ?? {},
  };
}

async function ensurePrincipalUser(principal: SchemaPrincipal) {
  const user = requireUserPrincipal(principal);
  await ensureUserForPrincipal({
    principalId: user.principalId,
    attributes: user.attributes,
  });
  return user;
}

function normalizeDraft(input: {
  readonly slug: string;
  readonly title: string;
  readonly statement: string;
  readonly includes?: readonly string[];
  readonly excludes?: readonly string[];
  readonly distinctions?: readonly {
    readonly term: string;
    readonly difference: string;
  }[];
  readonly examples?: readonly string[];
  readonly nonExamples?: readonly string[];
}): SchemaDraft {
  const result = validateSchemaDraft(input);
  if (!("ok" in result)) {
    throw new Error(result.message);
  }
  return result.draft;
}

function draftFromRow(row: ConceptSchema): SchemaDraft {
  return {
    slug: row.slug,
    title: row.title,
    statement: row.statement,
    includes: row.includes ?? [],
    excludes: row.excludes ?? [],
    distinctions: row.distinctions ?? [],
    examples: row.examples ?? [],
    nonExamples: row.nonExamples ?? [],
  };
}

export function publicSchemaRecord(row: ConceptSchema) {
  return {
    slug: row.slug,
    title: row.title,
    statement: row.statement,
    includes: row.includes ?? [],
    excludes: row.excludes ?? [],
    distinctions: row.distinctions ?? [],
    examples: row.examples ?? [],
    nonExamples: row.nonExamples ?? [],
    status: row.status,
    version: row.version,
  };
}

export async function searchSchemasForPrincipal(
  principal: SchemaPrincipal,
  query: string,
  limit?: number,
) {
  const user = requireUserPrincipal(principal);
  const rows = await searchConceptSchemas(
    user.principalId,
    query,
    limit ?? 8,
  );
  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    statement: row.statement,
    status: row.status,
    version: row.version,
  }));
}

export async function getSchemaForPrincipal(
  principal: SchemaPrincipal,
  slug: string,
) {
  const user = requireUserPrincipal(principal);
  const row = await getConceptSchemaBySlug(user.principalId, slug.trim());
  return row ? publicSchemaRecord(row) : null;
}

export async function proposeSchemaForPrincipal(
  principal: SchemaPrincipal,
  input: {
    readonly action: "create" | "update" | "retire";
    readonly slug: string;
    readonly title?: string;
    readonly statement?: string;
    readonly includes?: readonly string[];
    readonly excludes?: readonly string[];
    readonly distinctions?: readonly {
      readonly term: string;
      readonly difference: string;
    }[];
    readonly examples?: readonly string[];
    readonly nonExamples?: readonly string[];
  },
) {
  const user = await ensurePrincipalUser(principal);
  const slug = input.slug.trim();

  if (input.action === "retire") {
    const existing = await getConceptSchemaBySlug(user.principalId, slug);
    if (!existing) {
      throw new Error(`No schema named "${slug}".`);
    }
    const row = await retireConceptSchema(user.principalId, existing);
    return { action: "retire" as const, schema: publicSchemaRecord(row) };
  }

  const draft = normalizeDraft({
    slug,
    title: input.title ?? "",
    statement: input.statement ?? "",
    includes: input.includes,
    excludes: input.excludes,
    distinctions: input.distinctions,
    examples: input.examples,
    nonExamples: input.nonExamples,
  });

  if (input.action === "create") {
    const clash = await getConceptSchemaBySlug(user.principalId, draft.slug);
    if (clash && clash.status === "active") {
      throw new Error(`You already have a schema named "${draft.slug}".`);
    }
    if (clash) {
      const row = await updateConceptSchema(
        user.principalId,
        clash,
        draft,
        true,
      );
      return { action: "update" as const, schema: publicSchemaRecord(row) };
    }
    const row = await createConceptSchema(user.principalId, draft);
    return { action: "create" as const, schema: publicSchemaRecord(row) };
  }

  const existing = await getConceptSchemaBySlug(user.principalId, slug);
  if (!existing) {
    throw new Error(`No schema named "${slug}".`);
  }

  const previous = draftFromRow(existing);
  const unchanged =
    existing.status === "active" && schemaBodiesEqual(previous, draft);
  const row = await updateConceptSchema(
    user.principalId,
    existing,
    draft,
    !unchanged,
  );
  return {
    action: "update" as const,
    schema: publicSchemaRecord(row),
    unchanged,
  };
}
