import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  conceptSchema,
  conceptSchemaRevision,
  type ConceptSchema,
  type ConceptSchemaDistinction,
} from "@/lib/db/schema";

export type ConceptSchemaBody = {
  readonly slug: string;
  readonly title: string;
  readonly statement: string;
  readonly includes: readonly string[];
  readonly excludes: readonly string[];
  readonly distinctions: readonly ConceptSchemaDistinction[];
  readonly examples: readonly string[];
  readonly nonExamples: readonly string[];
};

function asMutableList(items: readonly string[]): string[] {
  return [...items];
}

function asMutableDistinctions(
  items: readonly ConceptSchemaDistinction[],
): ConceptSchemaDistinction[] {
  return items.map((item) => ({
    term: item.term,
    difference: item.difference,
  }));
}

async function insertRevision(row: ConceptSchema): Promise<void> {
  await db.insert(conceptSchemaRevision).values({
    schemaId: row.id,
    userId: row.userId,
    version: row.version,
    slug: row.slug,
    title: row.title,
    statement: row.statement,
    includes: row.includes ?? [],
    excludes: row.excludes ?? [],
    distinctions: row.distinctions ?? [],
    examples: row.examples ?? [],
    nonExamples: row.nonExamples ?? [],
    status: row.status,
  });
}

export async function getConceptSchemaBySlug(
  userId: string,
  slug: string,
): Promise<ConceptSchema | null> {
  const [row] = await db
    .select()
    .from(conceptSchema)
    .where(and(eq(conceptSchema.userId, userId), eq(conceptSchema.slug, slug)))
    .limit(1);
  return row ?? null;
}

export async function searchConceptSchemas(
  userId: string,
  query: string,
  limit = 8,
): Promise<readonly ConceptSchema[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return db
      .select()
      .from(conceptSchema)
      .where(
        and(
          eq(conceptSchema.userId, userId),
          eq(conceptSchema.status, "active"),
        ),
      )
      .orderBy(asc(conceptSchema.title))
      .limit(limit);
  }

  const pattern = `%${trimmed.replace(/[%_\\]/g, "\\$&")}%`;
  return db
    .select()
    .from(conceptSchema)
    .where(
      and(
        eq(conceptSchema.userId, userId),
        eq(conceptSchema.status, "active"),
        or(
          ilike(conceptSchema.slug, pattern),
          ilike(conceptSchema.title, pattern),
          ilike(conceptSchema.statement, pattern),
          sql`${conceptSchema.includes}::text ilike ${pattern}`,
          sql`${conceptSchema.excludes}::text ilike ${pattern}`,
        ),
      ),
    )
    .orderBy(asc(conceptSchema.title))
    .limit(limit);
}

export async function createConceptSchema(
  userId: string,
  body: ConceptSchemaBody,
): Promise<ConceptSchema> {
  const [row] = await db
    .insert(conceptSchema)
    .values({
      userId,
      slug: body.slug,
      title: body.title,
      statement: body.statement,
      includes: asMutableList(body.includes),
      excludes: asMutableList(body.excludes),
      distinctions: asMutableDistinctions(body.distinctions),
      examples: asMutableList(body.examples),
      nonExamples: asMutableList(body.nonExamples),
      status: "active",
      version: 1,
    })
    .returning();
  if (!row) {
    throw new Error("Could not create schema.");
  }
  await insertRevision(row);
  return row;
}

export async function updateConceptSchema(
  userId: string,
  existing: ConceptSchema,
  body: ConceptSchemaBody,
  bumpVersion: boolean,
): Promise<ConceptSchema> {
  const nextVersion = bumpVersion ? existing.version + 1 : existing.version;
  const [row] = await db
    .update(conceptSchema)
    .set({
      slug: body.slug,
      title: body.title,
      statement: body.statement,
      includes: asMutableList(body.includes),
      excludes: asMutableList(body.excludes),
      distinctions: asMutableDistinctions(body.distinctions),
      examples: asMutableList(body.examples),
      nonExamples: asMutableList(body.nonExamples),
      status: "active",
      version: nextVersion,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(conceptSchema.userId, userId),
        eq(conceptSchema.id, existing.id),
      ),
    )
    .returning();
  if (!row) {
    throw new Error("Could not update schema.");
  }
  if (bumpVersion) {
    await insertRevision(row);
  }
  return row;
}

export async function retireConceptSchema(
  userId: string,
  existing: ConceptSchema,
): Promise<ConceptSchema> {
  if (existing.status === "retired") {
    return existing;
  }
  const nextVersion = existing.version + 1;
  const [row] = await db
    .update(conceptSchema)
    .set({
      status: "retired",
      version: nextVersion,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(conceptSchema.userId, userId),
        eq(conceptSchema.id, existing.id),
      ),
    )
    .returning();
  if (!row) {
    throw new Error("Could not retire schema.");
  }
  await insertRevision(row);
  return row;
}

export async function listConceptSchemaRevisions(
  userId: string,
  schemaId: string,
): Promise<readonly (typeof conceptSchemaRevision.$inferSelect)[]> {
  return db
    .select()
    .from(conceptSchemaRevision)
    .where(
      and(
        eq(conceptSchemaRevision.userId, userId),
        eq(conceptSchemaRevision.schemaId, schemaId),
      ),
    )
    .orderBy(desc(conceptSchemaRevision.version));
}
