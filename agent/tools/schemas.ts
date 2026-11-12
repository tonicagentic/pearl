import { defineDynamic, defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import {
  getSchemaForPrincipal,
  proposeSchemaForPrincipal,
  searchSchemasForPrincipal,
} from "#lib/user-schemas.js";
import { isPlanMode, planModeBlocked } from "#lib/turn-context.js";

const distinctionSchema = z.object({
  term: z.string().describe("Nearby term or concept."),
  difference: z
    .string()
    .describe("How this schema's concept differs from that term."),
});

const draftFields = {
  slug: z
    .string()
    .describe(
      "Stable id: starts with a letter or digit; letters, digits, '.', '_', '-' only.",
    ),
  title: z.string().describe("Short human title for the concept."),
  statement: z
    .string()
    .describe("One sentence that says what the concept is."),
  includes: z
    .array(z.string())
    .optional()
    .describe("Conditions that fall inside the concept."),
  excludes: z
    .array(z.string())
    .optional()
    .describe("Conditions that fall outside the concept."),
  distinctions: z
    .array(distinctionSchema)
    .optional()
    .describe("Nearby terms and how this concept differs."),
  examples: z.array(z.string()).optional().describe("Positive examples."),
  nonExamples: z
    .array(z.string())
    .optional()
    .describe("Near-miss examples that do not qualify."),
};

function formatProposePrompt(input: {
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
}): string {
  if (input.action === "retire") {
    return `Retire schema "${input.title?.trim() || input.slug}" (${input.slug})?`;
  }

  const verb = input.action === "create" ? "Save" : "Update";
  const lines = [
    `${verb} schema: ${input.title?.trim() || input.slug} (${input.slug})`,
  ];
  if (input.statement?.trim()) {
    lines.push(input.statement.trim());
  }
  if (input.includes && input.includes.length > 0) {
    lines.push(`Includes: ${input.includes.join("; ")}`);
  }
  if (input.excludes && input.excludes.length > 0) {
    lines.push(`Excludes: ${input.excludes.join("; ")}`);
  }
  if (input.distinctions && input.distinctions.length > 0) {
    lines.push(
      `Distinctions: ${input.distinctions
        .map((d) => `${d.term} — ${d.difference}`)
        .join("; ")}`,
    );
  }
  return lines.join("\n");
}

/**
 * Account-scoped concept schema tools for signed-in users.
 *
 * @remarks
 * Anonymous sessions get nothing. Search/get are read-only; propose_schema
 * always parks for approval and never writes on deny.
 */
export default defineDynamic((ctx) => {
  const principal = ctx.session.auth.current;
  if (principal?.principalType !== "user" || !principal.principalId) {
    return null;
  }

  return {
    search_schemas: defineTool({
      description:
        "Search this user's concept schemas by keyword (slug, title, statement, includes, excludes). " +
        "Call when a term must be unambiguous. Returns hits or found:false. Does not invent definitions.",
      inputSchema: z.object({
        query: z
          .string()
          .describe("Keyword or phrase to match against saved schemas."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe("Max hits to return. Defaults to 8."),
      }),
      async execute(input, toolCtx) {
        try {
          const hits = await searchSchemasForPrincipal(
            toolCtx.session.auth.current,
            input.query,
            input.limit,
          );
          if (hits.length === 0) {
            return { success: true as const, found: false as const, hits: [] };
          }
          return { success: true as const, found: true as const, hits };
        } catch (error) {
          return {
            success: false as const,
            error:
              error instanceof Error
                ? error.message
                : "Could not search schemas.",
          };
        }
      },
    }),

    get_schema: defineTool({
      description:
        "Load one concept schema by slug for this user (full definition). " +
        "Returns found:false when missing. Use after search_schemas when you need the full wording.",
      inputSchema: z.object({
        slug: z.string().describe("Schema slug to load."),
      }),
      async execute(input, toolCtx) {
        try {
          const schema = await getSchemaForPrincipal(
            toolCtx.session.auth.current,
            input.slug,
          );
          if (!schema) {
            return { success: true as const, found: false as const };
          }
          return {
            success: true as const,
            found: true as const,
            schema,
          };
        } catch (error) {
          return {
            success: false as const,
            error:
              error instanceof Error
                ? error.message
                : "Could not load schema.",
          };
        }
      },
    }),

    propose_schema: defineTool({
      description:
        "Propose creating, updating, or retiring a concept schema for this user. " +
        "Requires approval every time — the prompt shows the definition. " +
        "Interview with ask_question first when the draft is incomplete. Blocked in plan mode.",
      approval: {
        request: always(),
        prompt: ({ input }) => formatProposePrompt(input),
      },
      inputSchema: z.object({
        action: z
          .enum(["create", "update", "retire"])
          .describe("create a new schema, update an existing one, or retire it."),
        ...draftFields,
        title: draftFields.title.optional(),
        statement: draftFields.statement.optional(),
      }),
      async execute(input, toolCtx) {
        if (isPlanMode()) {
          return {
            success: false as const,
            ...planModeBlocked("propose_schema"),
          };
        }
        try {
          const result = await proposeSchemaForPrincipal(
            toolCtx.session.auth.current,
            input,
          );
          return { success: true as const, ...result };
        } catch (error) {
          return {
            success: false as const,
            error:
              error instanceof Error
                ? error.message
                : "Could not save schema.",
          };
        }
      },
    }),
  };
});
