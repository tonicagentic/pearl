/**
 * Pure validation for account-scoped concept schemas.
 * No database access — unit tests call these directly.
 */

export const MAX_SCHEMA_SLUG_LENGTH = 64;
export const MAX_SCHEMA_TITLE_LENGTH = 120;
export const MAX_SCHEMA_STATEMENT_LENGTH = 500;
export const MAX_SCHEMA_LIST_ITEMS = 12;
export const MAX_SCHEMA_LIST_ITEM_LENGTH = 240;
export const MAX_SCHEMA_DISTINCTION_TERM_LENGTH = 80;

/** Shell-safe slug: letter/digit start, then letters, digits, '.', '_', '-'. */
export const SCHEMA_SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export type SchemaValidationError = {
  readonly field?: string;
  readonly message: string;
};

export type SchemaDistinction = {
  readonly term: string;
  readonly difference: string;
};

export type SchemaDraft = {
  readonly slug: string;
  readonly title: string;
  readonly statement: string;
  readonly includes: readonly string[];
  readonly excludes: readonly string[];
  readonly distinctions: readonly SchemaDistinction[];
  readonly examples: readonly string[];
  readonly nonExamples: readonly string[];
};

function trimList(
  items: readonly string[] | undefined,
  field: string,
): { readonly ok: true; readonly items: string[] } | SchemaValidationError {
  const list = (items ?? []).map((item) => item.trim()).filter(Boolean);
  if (list.length > MAX_SCHEMA_LIST_ITEMS) {
    return {
      field,
      message: `${field} may have at most ${String(MAX_SCHEMA_LIST_ITEMS)} items.`,
    };
  }
  for (const item of list) {
    if (item.length > MAX_SCHEMA_LIST_ITEM_LENGTH) {
      return {
        field,
        message: `Each ${field} item must be at most ${String(MAX_SCHEMA_LIST_ITEM_LENGTH)} characters.`,
      };
    }
  }
  return { ok: true, items: list };
}

export function validateSchemaSlug(
  slug: string,
): SchemaValidationError | null {
  const trimmed = slug.trim();
  if (!trimmed) {
    return { field: "slug", message: "A schema needs a slug." };
  }
  if (trimmed.length > MAX_SCHEMA_SLUG_LENGTH) {
    return {
      field: "slug",
      message: `Slug must be at most ${String(MAX_SCHEMA_SLUG_LENGTH)} characters.`,
    };
  }
  if (!SCHEMA_SLUG_PATTERN.test(trimmed)) {
    return {
      field: "slug",
      message:
        "Slug must start with a letter or digit and contain only letters, digits, '.', '_', or '-'.",
    };
  }
  return null;
}

export function validateSchemaDraft(input: {
  readonly slug: string;
  readonly title: string;
  readonly statement: string;
  readonly includes?: readonly string[];
  readonly excludes?: readonly string[];
  readonly distinctions?: readonly SchemaDistinction[];
  readonly examples?: readonly string[];
  readonly nonExamples?: readonly string[];
}): SchemaValidationError | { readonly ok: true; readonly draft: SchemaDraft } {
  const slugError = validateSchemaSlug(input.slug);
  if (slugError) return slugError;

  const title = input.title.trim();
  if (!title) {
    return { field: "title", message: "A schema needs a title." };
  }
  if (title.length > MAX_SCHEMA_TITLE_LENGTH) {
    return {
      field: "title",
      message: `Title must be at most ${String(MAX_SCHEMA_TITLE_LENGTH)} characters.`,
    };
  }

  const statement = input.statement.trim();
  if (!statement) {
    return {
      field: "statement",
      message: "A schema needs a one-sentence statement.",
    };
  }
  if (statement.length > MAX_SCHEMA_STATEMENT_LENGTH) {
    return {
      field: "statement",
      message: `Statement must be at most ${String(MAX_SCHEMA_STATEMENT_LENGTH)} characters.`,
    };
  }

  const includes = trimList(input.includes, "includes");
  if (!("ok" in includes)) return includes;

  const excludes = trimList(input.excludes, "excludes");
  if (!("ok" in excludes)) return excludes;

  const examples = trimList(input.examples, "examples");
  if (!("ok" in examples)) return examples;

  const nonExamples = trimList(input.nonExamples, "nonExamples");
  if (!("ok" in nonExamples)) return nonExamples;

  const rawDistinctions = input.distinctions ?? [];
  if (rawDistinctions.length > MAX_SCHEMA_LIST_ITEMS) {
    return {
      field: "distinctions",
      message: `distinctions may have at most ${String(MAX_SCHEMA_LIST_ITEMS)} items.`,
    };
  }

  const distinctions: SchemaDistinction[] = [];
  for (const entry of rawDistinctions) {
    const term = entry.term.trim();
    const difference = entry.difference.trim();
    if (!term || !difference) {
      return {
        field: "distinctions",
        message: "Each distinction needs a term and a difference.",
      };
    }
    if (term.length > MAX_SCHEMA_DISTINCTION_TERM_LENGTH) {
      return {
        field: "distinctions",
        message: `Distinction terms must be at most ${String(MAX_SCHEMA_DISTINCTION_TERM_LENGTH)} characters.`,
      };
    }
    if (difference.length > MAX_SCHEMA_LIST_ITEM_LENGTH) {
      return {
        field: "distinctions",
        message: `Distinction differences must be at most ${String(MAX_SCHEMA_LIST_ITEM_LENGTH)} characters.`,
      };
    }
    distinctions.push({ term, difference });
  }

  return {
    ok: true,
    draft: {
      slug: input.slug.trim(),
      title,
      statement,
      includes: includes.items,
      excludes: excludes.items,
      distinctions,
      examples: examples.items,
      nonExamples: nonExamples.items,
    },
  };
}

/** True when two drafts match after normalization (no version bump needed). */
export function schemaBodiesEqual(
  a: SchemaDraft,
  b: SchemaDraft,
): boolean {
  return (
    a.slug === b.slug &&
    a.title === b.title &&
    a.statement === b.statement &&
    JSON.stringify(a.includes) === JSON.stringify(b.includes) &&
    JSON.stringify(a.excludes) === JSON.stringify(b.excludes) &&
    JSON.stringify(a.distinctions) === JSON.stringify(b.distinctions) &&
    JSON.stringify(a.examples) === JSON.stringify(b.examples) &&
    JSON.stringify(a.nonExamples) === JSON.stringify(b.nonExamples)
  );
}
